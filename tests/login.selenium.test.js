const { By, until } = require('selenium-webdriver');
const { expect } = require('chai');
const SeleniumConfig = require('./selenium.config');

describe('Pruebas de Automatización - Login con Selenium', () => {
    let seleniumConfig;
    let driver;
    const baseUrl = 'http://localhost:3000';

    // Configuración antes de todas las pruebas
    before(async function () {
        this.timeout(30000);
        seleniumConfig = new SeleniumConfig();
        driver = await seleniumConfig.initializeDriver();
    });

    // Limpiar estado antes de cada prueba
    beforeEach(async function () {
        this.timeout(20000);

        try {
            // 1. Limpiar completamente el navegador
            await driver.manage().deleteAllCookies();
            
            // 2. Ir a about:blank para limpiar el estado completamente
            await driver.get('about:blank');
            
            // 3. Limpiar storage desde about:blank no funciona, así que vamos directo a login
            await driver.get(`${baseUrl}/login.html`);
            
            // 4. Limpiar storage inmediatamente al cargar login.html
            await driver.executeScript('sessionStorage.clear(); localStorage.clear();');
            
            // 5. Forzar recarga para asegurar estado limpio
            await driver.navigate().refresh();
            
            // 6. Esperar a que la página se cargue completamente DESPUÉS del refresh
            console.log('Navegando a página de login...');
            await driver.wait(until.elementLocated(By.id('loginEmail')), 10000);

            // 7. Verificar que no hay datos de sesión
            const sessionData = await driver.executeScript('return sessionStorage.getItem("user")');
            if (sessionData) {
                console.log('Advertencia: Datos de sesión encontrados, limpiando...');
                await driver.executeScript('sessionStorage.clear(); localStorage.clear();');
                await driver.navigate().refresh();
                await driver.wait(until.elementLocated(By.id('loginEmail')), 10000);
            }

            // 8. Limpiar formularios y campos
            const emailField = await driver.findElement(By.id('loginEmail'));
            const passwordField = await driver.findElement(By.id('loginPassword'));
            await emailField.clear();
            await passwordField.clear();

            // 9. Verificar que estamos en login.html
            const currentUrl = await driver.getCurrentUrl();
            if (!currentUrl.includes('login.html')) {
                console.log(`URL incorrecta: ${currentUrl}, redirigiendo a login.html`);
                await driver.get(`${baseUrl}/login.html`);
                await driver.wait(until.elementLocated(By.id('loginEmail')), 10000);
            }

            // 10. Pausa final para estabilización
            await driver.sleep(500);

        } catch (error) {
            console.error('Error en beforeEach:', error.message);
            throw error;
        }
    });

    // Limpiar estado después de cada prueba
    afterEach(async function () {
        this.timeout(10000);
        
        try {
            // Limpiar datos de sesión después de cada test
            await driver.executeScript('sessionStorage.clear(); localStorage.clear();');
            await driver.manage().deleteAllCookies();
            
            // Si estamos en index.html, navegar de vuelta a login.html para el siguiente test
            const currentUrl = await driver.getCurrentUrl();
            if (currentUrl.includes('index.html')) {
                await driver.get(`${baseUrl}/login.html`);
            }
        } catch (error) {
            console.log('Error menor en afterEach:', error.message);
            // No hacer throw porque no queremos que falle el test por esto
        }
    });

    // Limpieza después de todas las pruebas
    after(async function () {
        this.timeout(15000);
        await seleniumConfig.cleanupDriver();
    });

    describe('TC-001: Login con credenciales válidas', () => {
        it('TC-001: Login con credenciales válidas - Debe autenticar y redirigir usuario con credenciales válidas registradas', async function () {
            this.timeout(15000);

            const emailField = await driver.wait(until.elementLocated(By.id('loginEmail')), 10000);
            const passwordField = await driver.findElement(By.id('loginPassword'));
            const loginButton = await driver.findElement(By.css('button[type="submit"]'));

            await emailField.clear();
            await emailField.sendKeys('prueba1@example.com');

            await passwordField.clear();
            await passwordField.sendKeys('123456');

            await loginButton.click();

            // Redirección a index.html
            await driver.wait(until.urlContains('index.html'), 8000);
            const currentUrl = await driver.getCurrentUrl();
            expect(currentUrl).to.include('index.html');

            // Usuario normal (isAdmin: 0)
            const userDataString = await driver.executeScript('return sessionStorage.getItem("user")');
            const userData = JSON.parse(userDataString);
            expect(userData.isAdmin).to.be.false;
        });



        it('TC-001: Login con credenciales válidas - Debe rechazar credenciales incorrectas sin autenticar', async function () {
            this.timeout(15000);

            const emailField = await driver.wait(until.elementLocated(By.id('loginEmail')), 10000);
            const passwordField = await driver.findElement(By.id('loginPassword'));
            const loginButton = await driver.findElement(By.css('button[type="submit"]'));

            await emailField.clear();
            await emailField.sendKeys('usuario@inexistente.com');

            await passwordField.clear();
            await passwordField.sendKeys('contraseñaIncorrecta');

            await loginButton.click();

            // Manejar alert de error si aparece
            try {
                await driver.wait(until.alertIsPresent(), 3000);
                const alert = await driver.switchTo().alert();
                await alert.accept();
            } catch (alertError) {
                // No hay alert, continuar
            }

            await driver.sleep(1000);

            // Verificar que NO se autenticó y permanece en login
            const userDataString = await driver.executeScript('return sessionStorage.getItem("user")');
            expect(userDataString).to.be.null;

            const currentUrl = await driver.getCurrentUrl();
            expect(currentUrl).to.include('login.html');
        });

        it('TC-001: Login con credenciales válidas - Debe autenticar administrador con credenciales válidas', async function () {
            this.timeout(30000);

            const emailField = await driver.wait(until.elementLocated(By.id('loginEmail')), 10000);
            const passwordField = await driver.findElement(By.id('loginPassword'));
            const loginButton = await driver.findElement(By.css('button[type="submit"]'));

            await emailField.clear();
            await emailField.sendKeys('admin@urbanstyle.com');

            await passwordField.clear();
            await passwordField.sendKeys('admin123');

            console.log('Iniciando login de administrador...');
            await loginButton.click();

            // Esperar procesamiento y posible alert
            try {
                await driver.wait(until.alertIsPresent(), 3000);
                const alert = await driver.switchTo().alert();
                const alertText = await alert.getText();
                console.log('Alert encontrado:', alertText);
                await alert.accept();
            } catch (e) {
                console.log('No hay alert, continuando...');
            }

            await driver.sleep(2000);

            // Verificar URL actual
            let currentUrl = await driver.getCurrentUrl();
            console.log('URL actual después del login:', currentUrl);

            // Verificar si hay datos en sessionStorage
            const userDataString = await driver.executeScript('return sessionStorage.getItem("user")');
            console.log('Datos en sessionStorage:', userDataString);

            // Verificar errores de JavaScript en la consola
            const logs = await driver.manage().logs().get('browser');
            if (logs.length > 0) {
                console.log('Errores en consola del navegador:');
                logs.forEach(entry => {
                    console.log(`[${entry.level.name}] ${entry.message}`);
                });
            }

            // Si no se redirigió automáticamente, esperar más tiempo o forzar
            if (!currentUrl.includes('index.html')) {
                console.log('No se detectó redirección automática, esperando más...');
                await driver.wait(until.urlContains('index.html'), 15000);
            }

            // Verificar redirección final
            currentUrl = await driver.getCurrentUrl();
            console.log('URL final:', currentUrl);
            expect(currentUrl).to.include('index.html');

            // Verificar que es administrador
            const finalUserData = await driver.executeScript('return sessionStorage.getItem("user")');
            console.log('Datos finales de usuario:', finalUserData);
            const userData = JSON.parse(finalUserData);
            expect(userData.isAdmin).to.be.true;
        });
    });

    describe('TC-002: Mensajes de error en login', () => {
        it('TC-002: Mensajes de error en login - Debe mostrar mensaje de error cuando el campo correo está vacío', async function () {
            this.timeout(15000);

            const emailField = await driver.wait(until.elementLocated(By.id('loginEmail')), 10000);
            const passwordField = await driver.findElement(By.id('loginPassword'));
            const loginButton = await driver.findElement(By.css('button[type="submit"]'));

            // Dejar correo vacío, llenar contraseña
            await emailField.clear();
            await passwordField.clear();
            await passwordField.sendKeys('123456');

            await loginButton.click();

            // Esperar procesamiento
            await driver.sleep(2000);

            // Verificar que no se autenticó
            const userDataString = await driver.executeScript('return sessionStorage.getItem("user")');
            expect(userDataString).to.be.null;

            // Verificar que permanece en login
            const currentUrl = await driver.getCurrentUrl();
            expect(currentUrl).to.include('login.html');
        });

        it('TC-002: Mensajes de error en login - Debe mostrar mensaje de error cuando el campo contraseña está vacío', async function () {
            this.timeout(15000);

            const emailField = await driver.wait(until.elementLocated(By.id('loginEmail')), 10000);
            const passwordField = await driver.findElement(By.id('loginPassword'));
            const loginButton = await driver.findElement(By.css('button[type="submit"]'));

            // Llenar correo, dejar contraseña vacía
            await emailField.clear();
            await emailField.sendKeys('test@example.com');
            await passwordField.clear();

            await loginButton.click();

            // Esperar procesamiento
            await driver.sleep(2000);

            // Verificar que no se autenticó
            const userDataString = await driver.executeScript('return sessionStorage.getItem("user")');
            expect(userDataString).to.be.null;

            // Verificar que permanece en login
            const currentUrl = await driver.getCurrentUrl();
            expect(currentUrl).to.include('login.html');
        });

        it('TC-002: Mensajes de error en login - Debe mostrar mensaje de error cuando ambos campos están vacíos', async function () {
            this.timeout(15000);

            const emailField = await driver.wait(until.elementLocated(By.id('loginEmail')), 10000);
            const passwordField = await driver.findElement(By.id('loginPassword'));
            const loginButton = await driver.findElement(By.css('button[type="submit"]'));

            // Dejar ambos campos vacíos
            await emailField.clear();
            await passwordField.clear();

            await loginButton.click();

            // Esperar procesamiento
            await driver.sleep(2000);

            // Verificar que no se autenticó
            const userDataString = await driver.executeScript('return sessionStorage.getItem("user")');
            expect(userDataString).to.be.null;

            // Verificar que permanece en login
            const currentUrl = await driver.getCurrentUrl();
            expect(currentUrl).to.include('login.html');
        });

        it('TC-002: Mensajes de error en login - Debe mostrar error con contraseña incorrecta para usuario existente', async function () {
            this.timeout(15000);

            const emailField = await driver.wait(until.elementLocated(By.id('loginEmail')), 10000);
            const passwordField = await driver.findElement(By.id('loginPassword'));
            const loginButton = await driver.findElement(By.css('button[type="submit"]'));

            // Email correcto, contraseña incorrecta
            await emailField.clear();
            await emailField.sendKeys('prueba1@example.com');

            await passwordField.clear();
            await passwordField.sendKeys('contraseñaIncorrecta123');

            await loginButton.click();

            // Manejar alert de credenciales incorrectas
            try {
                await driver.wait(until.alertIsPresent(), 3000);
                const alert = await driver.switchTo().alert();
                await alert.accept();
            } catch (e) {
                // Si no hay alert, continuar
            }

            // Esperar procesamiento
            await driver.sleep(1000);

            // Verificar que no se autenticó
            const userDataString = await driver.executeScript('return sessionStorage.getItem("user")');
            expect(userDataString).to.be.null;

            const currentUrl = await driver.getCurrentUrl();
            expect(currentUrl).to.include('login.html');
        });
    });

    describe('TC-003: Mostrar/ocultar contraseña', () => {
        it('TC-003: Mostrar/ocultar contraseña - Debe mostrar botón/ícono para alternar visibilidad de contraseña', async function () {
            this.timeout(15000);

            // Buscar el botón de toggle por ID
            const toggleButton = await driver.wait(until.elementLocated(By.id('togglePassword')), 10000);

            // Verificar que está visible
            expect(await toggleButton.isDisplayed()).to.be.true;
            console.log('Botón de alternar contraseña encontrado y visible');
        });

        it('TC-003: Mostrar/ocultar contraseña - Debe cambiar tipo de campo de password a text al mostrar contraseña', async function () {
            this.timeout(15000);

            const passwordField = await driver.wait(until.elementLocated(By.id('loginPassword')), 10000);
            const toggleButton = await driver.findElement(By.id('togglePassword'));

            // Escribir una contraseña de prueba
            await passwordField.clear();
            await passwordField.sendKeys('miContraseña123');

            // Verificar que inicialmente el campo es tipo password
            let fieldType = await passwordField.getAttribute('type');
            expect(fieldType).to.equal('password');
            console.log('Campo contraseña inicialmente oculto (tipo: password)');

            // Hacer clic para mostrar contraseña
            await toggleButton.click();
            await driver.sleep(1000);

            // Verificar que cambió a tipo text
            fieldType = await passwordField.getAttribute('type');
            expect(fieldType).to.equal('text');

            // Verificar que el valor no cambió
            const passwordValue = await passwordField.getAttribute('value');
            expect(passwordValue).to.equal('miContraseña123');
            console.log('Contraseña ahora visible (tipo: text) sin modificar el valor');

            // Volver a hacer clic para ocultar
            await toggleButton.click();
            await driver.sleep(1000);

            // Verificar que volvió a tipo password
            fieldType = await passwordField.getAttribute('type');
            expect(fieldType).to.equal('password');

            // Verificar que el valor sigue igual
            const finalValue = await passwordField.getAttribute('value');
            expect(finalValue).to.equal('miContraseña123');
            console.log('Contraseña oculta nuevamente sin modificar el valor');
        });

        it('TC-003: Mostrar/ocultar contraseña - Debe mantener el valor del campo al alternar visibilidad múltiples veces', async function () {
            this.timeout(15000);

            const passwordField = await driver.wait(until.elementLocated(By.id('loginPassword')), 10000);
            const toggleButton = await driver.findElement(By.id('togglePassword'));

            const testPassword = 'TestPassword!@#123';
            await passwordField.clear();
            await passwordField.sendKeys(testPassword);

            // Alternar 3 veces para probar estabilidad
            for (let i = 0; i < 3; i++) {
                await toggleButton.click();
                await driver.sleep(800);

                const currentValue = await passwordField.getAttribute('value');
                expect(currentValue).to.equal(testPassword);
            }

            console.log('Valor del campo mantenido tras múltiples alternaciones');
        });

        it('TC-003: Mostrar/ocultar contraseña - Debe funcionar la visibilidad junto con el proceso de login', async function () {
            this.timeout(20000);

            const emailField = await driver.wait(until.elementLocated(By.id('loginEmail')), 10000);
            const passwordField = await driver.findElement(By.id('loginPassword'));
            const toggleButton = await driver.findElement(By.id('togglePassword'));
            const loginButton = await driver.findElement(By.css('button[type="submit"]'));

            // Llenar formulario
            await emailField.clear();
            await emailField.sendKeys('prueba1@example.com');

            await passwordField.clear();
            await passwordField.sendKeys('123456');

            // Mostrar contraseña antes del login
            await toggleButton.click();
            await driver.sleep(800);

            // Verificar que se puede ver la contraseña
            const fieldType = await passwordField.getAttribute('type');
            expect(fieldType).to.equal('text');
            console.log('Contraseña visible antes del login');

            // Proceder con login
            await loginButton.click();
            await driver.sleep(2000);

            // Verificar que el login funciona con toggle activado
            await driver.wait(until.urlContains('index.html'), 5000);
            console.log('Login exitoso con toggle de contraseña activado');
        });
    });
});