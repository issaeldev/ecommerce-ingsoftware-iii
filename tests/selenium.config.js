const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

class SeleniumConfig {
    constructor() {
        this.driver = null;
        this.baseUrl = 'http://localhost:3000';
    }

    async initializeDriver() {
        console.log('Iniciando configuración de Selenium...');

        const options = new chrome.Options();
        options.addArguments('--headless');
        options.addArguments('--no-sandbox');
        options.addArguments('--disable-dev-shm-usage');
        options.addArguments('--window-size=1920,1080');
        options.addArguments('--disable-web-security');
        options.addArguments('--allow-running-insecure-content');

        try {
            require('chromedriver');
            console.log('Intentando crear el driver...');
            this.driver = await new Builder()
                .forBrowser('chrome')
                .setChromeOptions(options)
                .build();
            console.log('Driver iniciado correctamente');
            return this.driver;
        } catch (error) {
            console.error('Error al iniciar el navegador:', error);
            throw error;
        }
    }

    async cleanupDriver() {
        if (this.driver) {
            try {
                console.log('Cerrando navegador...');
                await this.driver.quit();
                console.log('Navegador cerrado correctamente');
            } catch (error) {
                console.warn('Advertencia al cerrar navegador:', error.message);
            }
        }
    }

    async resetState() {
        if (!this.driver) {
            throw new Error('Driver no inicializado');
        }
        
        // Limpiar cookies
        await this.driver.manage().deleteAllCookies();
        
        // Limpiar storage solo si estamos en una página válida
        try {
            const currentUrl = await this.driver.getCurrentUrl();
            if (currentUrl.startsWith('http')) {
                await this.driver.executeScript('sessionStorage.clear(); localStorage.clear();');
            }
        } catch (error) {
            // Ignorar errores de storage en páginas especiales
            console.log('Storage no disponible en esta página, continuando...');
        }
    }
}

module.exports = SeleniumConfig;