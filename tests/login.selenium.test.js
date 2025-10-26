const { By, until } = require('selenium-webdriver');
const { expect } = require('chai');
const SeleniumConfig = require('./selenium.config');

describe('Pruebas de Automatización - Login con Selenium', () => {
    let seleniumConfig;
    let driver;
    const baseUrl = 'http://localhost:3000';

    // --- HOOKS GLOBALES ---
    // Se ejecuta una vez antes de todas las pruebas para iniciar el navegador.
    before(async function() {
        this.timeout(30000);
        seleniumConfig = new SeleniumConfig();
        driver = await seleniumConfig.initializeDriver();
    });

    // Se ejecuta una vez después de todas las pruebas para cerrar el navegador.
    after(async function() {
        this.timeout(15000);
        await seleniumConfig.cleanupDriver();
    });

    // Se ejecuta antes de CADA prueba para asegurar un estado limpio.
    beforeEach(async function() {
        this.timeout(15000);
        // Limpia el estado y navega a la página de login.
        await driver.get('about:blank'); // Página neutral para limpiar
        await driver.get(`${baseUrl}/login.html`);
        await driver.executeScript('sessionStorage.clear(); localStorage.clear();');
        await driver.wait(until.elementLocated(By.id('loginEmail')), 10000);
    });

    // --- SUITE DE PRUEBAS PARA LOGIN VÁLIDO ---
    describe('TC-001: Login con credenciales válidas', () => {

        it('TC-001: Debe autenticar y redirigir a un usuario normal con credenciales válidas', async function() {
            this.timeout(15000);
            
            await driver.findElement(By.id('loginEmail')).sendKeys('prueba1@example.com');
            await driver.findElement(By.id('loginPassword')).sendKeys('123456');
            await driver.findElement(By.css('button[type="submit"]')).click();

            // Espera inteligente: no avanza hasta que la URL contenga 'index.html'.
            await driver.wait(until.urlContains('index.html'), 10000);
            
            // Verifica que el usuario guardado en sesión NO es admin.
            const userData = await driver.executeScript('return JSON.parse(sessionStorage.getItem("user"))');
            expect(userData.isAdmin).to.be.false;
        });

        it('TC-001: Debe autenticar a un administrador con credenciales válidas', async function() {
            this.timeout(15000);
            
            await driver.findElement(By.id('loginEmail')).sendKeys('admin@urbanstyle.com');
            await driver.findElement(By.id('loginPassword')).sendKeys('admin123');
            await driver.findElement(By.css('button[type="submit"]')).click();

            await driver.wait(until.urlContains('index.html'), 10000);
            
            // Verifica que el usuario guardado en sesión SÍ es admin.
            const userData = await driver.executeScript('return JSON.parse(sessionStorage.getItem("user"))');
            expect(userData.isAdmin).to.be.true;
        });
    });

    // --- SUITE DE PRUEBAS PARA MENSAJES DE ERROR ---
    describe('TC-002: Mensajes de error en login', () => {
        
        it('TC-002: Debe mostrar un alert de error con credenciales incorrectas', async function() {
            this.timeout(15000);

            await driver.findElement(By.id('loginEmail')).sendKeys('usuario@inexistente.com');
            await driver.findElement(By.id('loginPassword')).sendKeys('contraseñaIncorrecta');
            await driver.findElement(By.css('button[type="submit"]')).click();

            // Espera inteligente: la prueba espera a que la alerta de error aparezca.
            await driver.wait(until.alertIsPresent(), 5000);
            const alert = await driver.switchTo().alert();
            const alertText = await alert.getText();
            
            // Verifica que el mensaje de error es el esperado y lo acepta.
            expect(alertText).to.include('Correo o contraseña incorrectos');
            await alert.accept();

            // Verifica que no se redirigió y se mantuvo en la página de login.
            const currentUrl = await driver.getCurrentUrl();
            expect(currentUrl).to.include('login.html');
        });

        it('TC-002: Debe impedir el envío si el campo de correo está vacío', async function() {
            this.timeout(15000);

            // Solo llena la contraseña.
            await driver.findElement(By.id('loginPassword')).sendKeys('123456');
            await driver.findElement(By.css('button[type="submit"]')).click();

            // Verifica el mensaje de validación de HTML5 en el campo de correo.
            const emailField = await driver.findElement(By.id('loginEmail'));
            const validationMessage = await emailField.getAttribute('validationMessage');
            expect(validationMessage).to.not.be.empty;
        });

        it('TC-002: Debe impedir el envío si el campo de contraseña está vacío', async function() {
            this.timeout(15000);

            // Solo llena el correo.
            await driver.findElement(By.id('loginEmail')).sendKeys('test@example.com');
            await driver.findElement(By.css('button[type="submit"]')).click();

            // Verifica el mensaje de validación de HTML5 en el campo de contraseña.
            const passwordField = await driver.findElement(By.id('loginPassword'));
            const validationMessage = await passwordField.getAttribute('validationMessage');
            expect(validationMessage).to.not.be.empty;
        });
    });

    // --- SUITE DE PRUEBAS PARA LA VISIBILIDAD DE LA CONTRASEÑA ---
    describe('TC-003: Mostrar/ocultar contraseña', () => {

        it('TC-003: Debe cambiar el tipo de campo de "password" a "text" y viceversa', async function() {
            this.timeout(15000);
            
            const passwordField = await driver.findElement(By.id('loginPassword'));
            const toggleButton = await driver.findElement(By.id('togglePassword'));
            const testPassword = 'miContraseña123';
            
            await passwordField.sendKeys(testPassword);

            // 1. Verifica que inicialmente es de tipo 'password'.
            expect(await passwordField.getAttribute('type')).to.equal('password');

            // 2. Hace clic para mostrar la contraseña.
            await toggleButton.click();
            // Espera a que el atributo cambie, en lugar de una espera ciega.
            await driver.wait(async () => (await passwordField.getAttribute('type')) === 'text', 5000);
            expect(await passwordField.getAttribute('value')).to.equal(testPassword);
            
            // 3. Hace clic para volver a ocultar.
            await toggleButton.click();
            await driver.wait(async () => (await passwordField.getAttribute('type')) === 'password', 5000);
            expect(await passwordField.getAttribute('value')).to.equal(testPassword);
        });
    });
});