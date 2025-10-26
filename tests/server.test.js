const request = require('supertest');
const { app, db, server } = require('../server');

describe('Pruebas de Integración para E-commerce API', () => {
  let adminToken = '';
  let userToken = '';
  let productoIdCreado = 0;

  beforeAll(async () => {
    const adminLoginRes = await request(app).post('/api/login').send({
      email: 'admin@urbanstyle.com',
      password: 'admin123'
    });
    adminToken = adminLoginRes.body.token;

    const userLoginRes = await request(app).post('/api/login').send({
      email: 'prueba1@example.com',
      password: '123456'
    });
    userToken = userLoginRes.body.token;
  });

  afterAll((done) => {
    db.close((err) => {
      if (err) {
        console.error(err.message);
        return done(err);
      }
      console.log('Conexión de la base de datos cerrada correctamente.');
      
      server.close(() => {
        console.log('Servidor cerrado.');
        done();
      });
    });
  });

  describe('Suite: Autenticación y Registro', () => {
    it('POST /api/register debe registrar un usuario nuevo', async () => {
      const emailRandom = `user${Date.now()}@test.com`;
      const res = await request(app).post('/api/register').send({
        name: 'Test', lastname: 'User', email: emailRandom, password: 'test123',
        document_type: 'DNI', document_number: '99999999', phone: '987654321'
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/register con campos incompletos debe dar 400', async () => {
      const res = await request(app).post('/api/register').send({ email: 'faltante@example.com', password: '123456' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBeDefined();
    });
    
    it('POST /api/register con email duplicado debe dar 400', async () => {
      const uniqueEmail = `duplicado_${Date.now()}@test.com`;
      const userData = {
        name: 'Duplicado', lastname: 'Test', email: uniqueEmail, password: '123456',
        document_type: 'DNI', document_number: '12345678', phone: '912345678'
      };
      
      const res1 = await request(app).post('/api/register').send(userData);
      expect(res1.statusCode).toBe(200);

      const res2 = await request(app).post('/api/register').send(userData);
      expect(res2.statusCode).toBe(400);
      expect(res2.body.error).toMatch(/ya existe/);
    });
  });

  /*
    PRUEBA DE INTEGRACIÓN 1: Gestión de Productos (CRUD).
    - Referencia: Valida la interacción entre los endpoints de productos ('/api/products') y el middleware de autenticación de administrador.
    - Flujo: Simula el ciclo de vida completo de un producto: creación, lectura, actualización y eliminación (CRUD), asegurando que solo un administrador pueda realizar estas acciones.
  */
  describe('Suite: CRUD de Productos (Admin)', () => {
    it('GET /api/products debe devolver una lista de productos', async () => {
      const res = await request(app).get('/api/products');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /api/products debe permitir la creación de un producto por un admin', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Polo de Prueba CRUD', description: 'Un polo para las pruebas', category: 'Polo',
          gender: 'Hombre', colors_json: JSON.stringify([{ "name": "Negro", "code": "#000000" }]),
          sizes: ['M', 'L'], price_base: 49.99, image: 'https://via.placeholder.com/150'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.id).toBeDefined();
      productoIdCreado = res.body.id;
    });

    it('PUT /api/products/:id debe actualizar un producto existente', async () => {
      const res = await request(app)
        .put(`/api/products/${productoIdCreado}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Polo Actualizado', description: 'Descripción actualizada', category: 'Polo', gender: 'Hombre',
          colors_json: JSON.stringify([{ "name": "Blanco", "code": "#FFFFFF" }]), sizes: 'L,XL',
          price_base: 59.99, stock: 20, image: 'https://via.placeholder.com/150'
        });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('DELETE /api/products/:id debe eliminar un producto', async () => {
      const res = await request(app)
        .delete(`/api/products/${productoIdCreado}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('DELETE /api/products/:id inexistente debe devolver 404', async () => {
        const res = await request(app)
          .delete('/api/products/999999')
          .set('Authorization', `Bearer ${adminToken}`);
        expect(res.statusCode).toBe(404);
    });
  });

  /*
    PRUEBA DE INTEGRACIÓN 2: Flujo de Compra de Usuario.
    - Referencia: Valida la interacción entre el registro de usuario, login, creación de orden ('/api/orden_compra') y consulta de detalles ('/api/detalle_compra').
    - Flujo: Simula el recorrido más importante de un cliente: se registra, inicia sesión, realiza una compra y luego verifica que esa compra aparezca en su historial.
  */
  describe('Suite: Flujo de Compra Completo de Usuario', () => {
    let testUserToken = '';
    const userEmail = `compra_${Date.now()}@example.com`;
    let productId = 0;
    let orderId = 0;

    beforeAll(async () => {
        await request(app).post('/api/register').send({
            name: 'Comprador', lastname: 'Prueba', email: userEmail, password: 'password123',
            document_type: 'DNI', document_number: '87654321', phone: '987654321'
        });
        const loginRes = await request(app).post('/api/login').send({ email: userEmail, password: 'password123' });
        testUserToken = loginRes.body.token;
        const productsRes = await request(app).get('/api/products');
        productId = productsRes.body[0].id;
    });

    it('debe crear una orden de compra con el producto', async () => {
      const res = await request(app)
        .post('/api/orden_compra')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          total: 49.99,
          items: [{ id: productId, quantity: 1, price_base: 49.99 }]
        });
      expect(res.statusCode).toBe(201);
      expect(res.body.orderId).toBeDefined();
      orderId = res.body.orderId;
    });

    it('el usuario debe poder ver su nueva orden en su historial', async () => {
      const res = await request(app)
        .get('/api/orden_compra')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.statusCode).toBe(200);
      const newOrder = res.body.find(order => order.id === orderId);
      expect(newOrder).toBeDefined();
    });

    it('el usuario debe poder ver el detalle de su nueva compra', async () => {
      const res = await request(app)
        .get('/api/detalle_compra')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.statusCode).toBe(200);
      const newPurchaseDetail = res.body.find(detail => detail.id_orden === orderId);
      expect(newPurchaseDetail).toBeDefined();
    });
  });

  /*
    PRUEBA DE INTEGRACIÓN 3: Control de Acceso por Roles.
    - Referencia: Valida que el middleware 'authenticateToken' y la lógica de roles (isAdmin) funcionen correctamente.
    - Flujo: Simula intentos de acceso a rutas protegidas. Se asegura de que un usuario sin token (no autenticado) reciba un error 401, y que un usuario regular (no-admin) reciba un error 403 al intentar acceder a recursos de administrador.
  */
  describe('Suite: Pruebas de Autorización y Permisos', () => {
    it('un usuario no-admin no debe poder crear un producto', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Producto Ilegal' });
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('No autorizado');
    });

    it('un usuario no-admin no debe poder eliminar un producto', async () => {
      const res = await request(app)
        .delete('/api/products/1')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.statusCode).toBe(403);
    });

    it('un usuario sin token no debe poder acceder a rutas protegidas', async () => {
        const res = await request(app).get('/api/orden_compra');
        expect(res.statusCode).toBe(401);
    });
  });
});