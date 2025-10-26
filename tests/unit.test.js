//PRUEBAS UNITARIAS - URBANSTYLE

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const SECRET = 'tu_clave_secreta';

//FUNCIONES AUXILIARES

function generateToken(userData) {
    return jwt.sign(userData, SECRET, { expiresIn: '2h' });
}

function verifyToken(token) {
    try {
        return jwt.verify(token, SECRET);
    } catch (err) {
        return null;
    }
}

function isUserAdmin(user) {
    return !!user.isAdmin;
}

function hashPassword(password) {
    return bcrypt.hashSync(password, 10);
}

function comparePassword(password, hash) {
    return bcrypt.compareSync(password, hash);
}

//SUITE DE PRUEBAS UNITARIAS

describe('Suite de Pruebas Unitarias - UrbanStyle', () => {

    //PRUEBA 1: Verificación de Token JWT =====
    describe('Prueba 1: Verificación de Token JWT', () => {

        it('TC-007: Genera un token JWT válido con datos de usuario', () => {
            const userData = { id: 1, email: 'test@example.com', isAdmin: false };
            const token = generateToken(userData);

            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.').length).toBe(3);
        });

            it('TC-007: Decodifica correctamente un token válido', () => {
                const userData = { id: 1, email: 'test@example.com', isAdmin: false };
                const token = generateToken(userData);
                const decoded = verifyToken(token);

                expect(decoded).not.toBeNull();
                expect(decoded.id).toBe(userData.id);
                expect(decoded.email).toBe(userData.email);
                expect(decoded.isAdmin).toBe(userData.isAdmin);
            });

        it('TC-007: Retorna null para un token inválido', () => {
            const invalidToken = 'token_invalido';
            const decoded = verifyToken(invalidToken);

            expect(decoded).toBeNull();
        });

        it('TC-007: Retorna null para un token malformado', () => {
            const malformed = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.malformed.signature';
            const decoded = verifyToken(malformed);

            expect(decoded).toBeNull();
        });

        it('TC-007: Incluye fecha de expiración futura', () => {
            const token = generateToken({ id: 1, email: 'test@test.com', isAdmin: true });
            const decoded = verifyToken(token);

            expect(decoded.exp).toBeDefined();
            expect(typeof decoded.exp).toBe('number');
            expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
        });
    });

    //PRUEBA 2: Permisos de Administrador
    describe('Prueba 2: Permisos de Administrador', () => {

        it('TC-008: Retorna true cuando isAdmin = 1', () => {
            expect(isUserAdmin({ isAdmin: 1 })).toBe(true);
        });

        it('TC-008: Retorna true cuando isAdmin = true', () => {
            expect(isUserAdmin({ isAdmin: true })).toBe(true);
        });

        it('TC-008: Retorna false cuando isAdmin = 0', () => {
            expect(isUserAdmin({ isAdmin: 0 })).toBe(false);
        });

        it('TC-008: Retorna false cuando isAdmin = false', () => {
            expect(isUserAdmin({ isAdmin: false })).toBe(false);
        });

        it('TC-008: Retorna false cuando no existe la propiedad isAdmin', () => {
            expect(isUserAdmin({})).toBe(false);
        });

        it('TC-008: Retorna false cuando isAdmin = null', () => {
            expect(isUserAdmin({ isAdmin: null })).toBe(false);
        });
    });

    //PRUEBA 3: Encriptación de Contraseñas
    describe('Prueba 3: Encriptación de Contraseñas', () => {

        it('TC-009: Encripta y el hash es distinto al texto plano', () => {
            const plain = 'miPassword123';
            const hash = hashPassword(plain);

            expect(hash).toBeDefined();
            expect(hash).not.toBe(plain);
            expect(hash.length).toBeGreaterThan(20);
        });

        it('TC-009: comparePassword retorna true con contraseña correcta', () => {
            const plain = 'password123';
            const hash = hashPassword(plain);

            expect(comparePassword(plain, hash)).toBe(true);
        });

        it('TC-009: comparePassword retorna false con contraseña incorrecta', () => {
            const plain = 'password123';
            const wrong = 'password456';
            const hash = hashPassword(plain);

            expect(comparePassword(wrong, hash)).toBe(false);
        });

        it('TC-009: Genera hashes diferentes para la misma contraseña (salt)', () => {
            const pwd = 'samePassword';
            const h1 = hashPassword(pwd);
            const h2 = hashPassword(pwd);

            expect(h1).not.toBe(h2);
            expect(comparePassword(pwd, h1)).toBe(true);
            expect(comparePassword(pwd, h2)).toBe(true);
        });

        it('TC-009: Maneja contraseñas con caracteres especiales', () => {
            const complex = 'P@ssw0rd!#$%&*()_+=-{}[]';
            const hash = hashPassword(complex);

            expect(comparePassword(complex, hash)).toBe(true);
            expect(comparePassword('Wrong', hash)).toBe(false);
        });
    });
});
