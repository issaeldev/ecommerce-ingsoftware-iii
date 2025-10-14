const request = require('supertest');
const app = require('../server');

let adminToken = '';
let userToken = '';
let productoIdCreado = 0;

describe('Pruebas API UrbanStyle', () => {

  // Registro de usuario único
  it('POST /api/register debe registrar usuario nuevo', async () => {
    const emailRandom = `user${Date.now()}@test.com`;
    const res = await request(app).post('/api/register').send({
      name: 'Test',
      lastname: 'User',
      email: emailRandom,
      password: 'test123',
      document_type: 'DNI',
      document_number: '99999999',
      phone: '987654321'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/register con campos incompletos debe dar 400', async () => {
  const res = await request(app).post('/api/register').send({
    email: 'faltante@example.com',
    password: '123456'
    // falta name, lastname, etc.
  });
  expect(res.statusCode).toBe(400);
  expect(res.body.error).toBeDefined();
});

it('POST /api/register con email duplicado debe dar 400', async () => {
  const res = await request(app).post('/api/register').send({
    name: 'Duplicado',
    lastname: 'Test',
    email: 'prueba1@example.com', // ya existe
    password: '123456',
    document_type: 'DNI',
    document_number: '12345678',
    phone: '912345678'
  });
  expect(res.statusCode).toBe(400);
  expect(res.body.error).toMatch(/ya existe/);
});



  // Login usuario regular
  it('POST /api/login debe loguear usuario y devolver token', async () => {
    const res = await request(app).post('/api/login').send({
      email: 'prueba1@example.com',
      password: '123456'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
    userToken = res.body.token;
  });

  // Login admin
  it('POST /api/login debe loguear admin y devolver token', async () => {
    const res = await request(app).post('/api/login').send({
      email: 'admin@urbanstyle.com',
      password: 'admin123'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.isAdmin).toBe(true);
    adminToken = res.body.token;
  });

  // Obtener lista de productos
  it('GET /api/products debe devolver productos', async () => {
    const res = await request(app).get('/api/products');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Crear producto como admin
  it('POST /api/products debe permitir creación de producto por admin', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Polo prueba',
        description: 'Un polo de prueba',
        category: 'Polo',
        gender: 'Hombre',
        colors_json: JSON.stringify(['#000000']),
        sizes: ['M', 'L'],
        price_base: 49.99,
        image: 'polo.jpg'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBeDefined();
    productoIdCreado = res.body.id;
  });

it('POST /api/products con datos incompletos debe fallar', async () => {
  const res = await request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: null, // Campo inválido
      description: 'Producto inválido'
      // faltan campos requeridos como category, gender, price_base, etc.
    });

  expect(res.statusCode).toBeGreaterThanOrEqual(400);
  expect(typeof res.body).toBe('object');

});



  // Crear producto sin token
  it('POST /api/products sin token debe responder 401', async () => {
    const res = await request(app).post('/api/products').send({});
    expect(res.statusCode).toBe(401);
  });

  // Crear producto como usuario normal (no admin)
  it('POST /api/products por usuario no admin debe responder 403', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${userToken}`)
      .send({});
    expect(res.statusCode).toBe(403);
  });

  // Actualizar producto existente
  it('PUT /api/products/:id debe actualizar producto', async () => {
    const res = await request(app)
      .put(`/api/products/${productoIdCreado}`)
      .send({
        name: 'Zapato actualizado',
        description: 'Actualizado',
        category: 'calzado',
        gender: 'hombre',
        colors_json: JSON.stringify(['#FFFFFF']),
        sizes: 'L',
        price_base: 59.99,
        stock: 10,
        image: 'nuevo.jpg'
      });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

    // Eliminar producto inexistente
  it('DELETE /api/products/:id inexistente debe devolver 404', async () => {
    const res = await request(app)
      .delete('/api/products/-1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(404);
  });
  // Eliminar producto como admin
  it('DELETE /api/products/:id debe eliminar producto', async () => {
    const res = await request(app)
      .delete(`/api/products/${productoIdCreado}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });



  // Eliminar producto sin token
  it('DELETE /api/products/:id sin token debe devolver 401', async () => {
    const res = await request(app).delete('/api/products/1');
    expect(res.statusCode).toBe(401);
  });

  // Eliminar producto como no admin
  it('DELETE /api/products/:id por no admin debe devolver 403', async () => {
    const res = await request(app)
      .delete('/api/products/1')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.statusCode).toBe(403);
  });

});