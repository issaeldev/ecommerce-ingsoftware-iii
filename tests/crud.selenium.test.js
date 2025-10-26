const { By, until, Key } = require('selenium-webdriver');
const { expect } = require('chai');
const SeleniumConfig = require('./selenium.config');

describe('Pruebas de Automatización - CRUD de Productos con Selenium', () => {
    let seleniumConfig;
    let driver;
    const baseUrl = 'http://localhost:3000';
    
    // Configuración inicial que se ejecuta una vez antes de todas las pruebas.
    before(async function() {
        this.timeout(30000);
        seleniumConfig = new SeleniumConfig();
        driver = await seleniumConfig.initializeDriver();
    });

    // Limpieza final que se ejecuta una vez después de todas las pruebas.
    after(async function() {
        this.timeout(15000);
        await seleniumConfig.cleanupDriver();
    });

    // --- Suite para Añadir Productos ---
    describe('TC-004: Añadir producto (CRUD)', () => {
        // Antes de cada prueba en esta suite, inicia sesión como admin y navega a la página de añadir producto.
        beforeEach(async function() {
            this.timeout(20000);
            await driver.get(`${baseUrl}/login.html`);
            await driver.wait(until.elementLocated(By.id('loginEmail')), 10000);
            await driver.manage().deleteAllCookies();
            await driver.executeScript('sessionStorage.clear(); localStorage.clear();');
            await driver.findElement(By.id('loginEmail')).sendKeys('admin@urbanstyle.com');
            await driver.findElement(By.id('loginPassword')).sendKeys('admin123');
            await driver.findElement(By.css('button[type="submit"]')).click();
            await driver.wait(until.urlContains('index.html'), 10000);
            
            await driver.get(`${baseUrl}/add-product.html`);
            await driver.wait(until.elementLocated(By.name('name')), 10000);
            console.log('Login de admin y navegación a "Añadir Producto" completados.');
        });

        it('TC-004: Añadir producto (CRUD) - Debe permitir añadir un producto con campos válidos', async function() {
            this.timeout(25000);

            await driver.findElement(By.name('name')).sendKeys('Polo de Prueba Final');
            await driver.findElement(By.name('description')).sendKeys('Descripción final del producto');
            
            // --- LÓGICA DE SELECCIÓN ROBUSTA ---
            // 1. Selecciona el Género para disparar el JS que carga las categorías.
            await driver.findElement(By.id('genderSelect')).click();
            await driver.findElement(By.css('option[value="Hombre"]')).click();

            // 2. Espera explícita a que la opción de Categoría sea VISIBLE y luego haz clic.
            const categoryOption = await driver.wait(until.elementLocated(By.css('#categorySelect option[value="Polo"]')), 5000);
            await driver.wait(until.elementIsVisible(categoryOption), 5000);
            await categoryOption.click();

            // 3. Espera explícita a que la opción de Talla sea VISIBLE y luego haz clic.
            const sizeOption = await driver.wait(until.elementLocated(By.css('#sizeSelect option[value="M"]')), 5000);
            await driver.wait(until.elementIsVisible(sizeOption), 5000);
            await sizeOption.click();

            await driver.findElement(By.id('price')).sendKeys('39.99');
            await driver.findElement(By.name('image')).sendKeys('https://via.placeholder.com/150');
            await driver.findElement(By.css('.color-box[data-name="Negro"]')).click();

            // 4. Pausa final para asegurar que todos los eventos JS se procesen antes de enviar.
            await driver.sleep(500);

            await driver.findElement(By.css('button[type="submit"]')).click();

            // 5. Espera la alerta de éxito.
            await driver.wait(until.alertIsPresent(), 10000, 'La alerta de éxito no apareció a tiempo.');
            const alert = await driver.switchTo().alert();
            expect(await alert.getText()).to.include('Producto añadido con éxito');
            await alert.accept();
        });

        it('TC-004: Añadir producto (CRUD) - Debe mostrar error con nombre que contiene caracteres especiales', async function() {
            this.timeout(15000);
            const nameField = await driver.findElement(By.name('name'));
            await nameField.sendKeys('Polo <Inválido>');
            await driver.findElement(By.name('description')).click();
            const validationMessage = await nameField.getAttribute('validationMessage');
            expect(validationMessage).to.not.be.empty;
            console.log(`Validación de HTML5 funcionó. Mensaje: ${validationMessage}`);
        });
    });

    // --- Suite para Editar Productos ---
    describe('TC-005: Editar producto (CRUD)', () => {
        it('TC-005: Editar producto (CRUD) - Debe permitir editar un producto existente', async function() {
            this.timeout(20000);
            
            // La autenticación ya se hizo en el beforeEach global de la suite padre.
            await driver.get(`${baseUrl}/inventario.html`);
            await driver.wait(until.elementLocated(By.css('#inventoryBody tr')), 10000);
            console.log('Login de admin completado para Editar Producto');

            let firstRow = await driver.findElement(By.css('#inventoryBody tr:first-child'));
            await firstRow.findElement(By.css('.edit-btn')).click();
            
            const nameInput = await driver.wait(until.elementLocated(By.css('td[data-field="name"] input')), 5000);
            await nameInput.clear();
            await nameInput.sendKeys('Producto Editado Selenium');

            const saveButton = await firstRow.findElement(By.css('.save-btn'));
            await saveButton.click();
            
            await driver.wait(until.stalenessOf(saveButton), 10000);

            const updatedRow = await driver.findElement(By.css('#inventoryBody tr:first-child'));
            const updatedName = await updatedRow.findElement(By.css('td[data-field="name"]')).getText();
            expect(updatedName).to.equal('Producto Editado Selenium');
        });
    });
    
    // --- Suite para Eliminar Productos ---
    describe('TC-006: Eliminar producto (CRUD)', () => {
        it('TC-006: Eliminar producto (CRUD) - Debe cancelar eliminación cuando se rechaza confirmación', async function() {
            this.timeout(15000);
            
            await driver.get(`${baseUrl}/inventario.html`);
            await driver.wait(until.elementLocated(By.css('#inventoryBody tr')), 10000);
            console.log('Login de admin completado para Eliminar Producto (Cancelar)');

            const initialRows = await driver.findElements(By.css('#inventoryBody tr'));
            if (initialRows.length === 0) this.skip();

            await driver.findElement(By.css('#inventoryBody tr:first-child .delete-btn')).click();
            await driver.wait(until.alertIsPresent(), 5000);
            await (await driver.switchTo().alert()).dismiss();
            await driver.sleep(500);

            const finalRows = await driver.findElements(By.css('#inventoryBody tr'));
            expect(finalRows.length).to.equal(initialRows.length);
        });

        it('TC-006: Eliminar producto (CRUD) - Debe mostrar confirmación y eliminar producto correctamente', async function() {
            this.timeout(15000);
            
            await driver.get(`${baseUrl}/inventario.html`);
            await driver.wait(until.elementLocated(By.css('#inventoryBody tr')), 10000);
            console.log('Login de admin completado para Eliminar Producto (Confirmar)');
            
            const initialRows = await driver.findElements(By.css('#inventoryBody tr'));
            if (initialRows.length === 0) this.skip();
            const initialCount = initialRows.length;

            await driver.findElement(By.css('#inventoryBody tr:first-child .delete-btn')).click();
            await driver.wait(until.alertIsPresent(), 5000);
            await (await driver.switchTo().alert()).accept();

            await driver.wait(async () => {
                const currentRows = await driver.findElements(By.css('#inventoryBody tr'));
                return currentRows.length < initialCount;
            }, 10000, 'La fila no fue eliminada a tiempo.');
        });        
    });
});