import http from 'k6/http';
import { check, sleep, group } from 'k6';

// --- CONFIGURACIÓN DE LA PRUEBA ---
export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 20 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    'http_req_failed': ['rate<0.01'],
    'http_req_duration': ['p(95)<500'],
  },
};

const BASE_URL = 'http://localhost:3000';
const headers = { 'Content-Type': 'application/json' };

// --- FUNCIÓN DE SETUP: Se ejecuta una sola vez al inicio ---
// Prepara todos los datos necesarios para la prueba (usuarios y un producto).
export function setup() {
  console.log('Iniciando fase de setup...');
  
  // 1. Obtener token de administrador para crear un producto.
  const adminLoginPayload = JSON.stringify({ email: 'admin@urbanstyle.com', password: 'admin123' });
  const adminRes = http.post(`${BASE_URL}/api/login`, adminLoginPayload, { headers });
  const adminToken = adminRes.json('token');

  if (!adminToken) {
    throw new Error('No se pudo obtener el token de administrador. Asegúrate de que las credenciales son correctas.');
  }

  // 2. Crear un único producto para que todos los usuarios lo compren.
  const productPayload = JSON.stringify({
    name: 'Producto de Prueba de Carga', description: 'Test', category: 'Polo',
    gender: 'Hombre', colors_json: '[]', sizes: ['M'], price_base: 49.99, image: 'test.jpg'
  });
  const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` };
  const productRes = http.post(`${BASE_URL}/api/products`, productPayload, { headers: authHeaders });
  
  const productId = productRes.json('id');
  if (!productId) {
      throw new Error('No se pudo crear el producto para la prueba.');
  }
  console.log(`Producto de prueba creado con ID: ${productId}`);

  // 3. Crear 20 usuarios de prueba de forma secuencial para evitar errores.
  console.log('Creando usuarios de prueba...');
  const users = [];
  const runId = Date.now(); // ID único para esta ejecución de prueba.

  for (let i = 0; i < 20; i++) {
    const userEmail = `loadtest_user_${runId}_${i}@test.com`; // Email único garantizado.
    const password = 'testpassword123';

    const registerPayload = JSON.stringify({
      email: userEmail, password, name: 'Load', lastname: 'Test',
      document_type: 'DNI', document_number: '12345678', phone: '987654321',
    });

    const regRes = http.post(`${BASE_URL}/api/register`, registerPayload, { headers });
    if (regRes.status === 200) {
      users.push({ email: userEmail, password: password });
    }
    sleep(0.1); // Pausa de 100ms para no saturar SQLite.
  }

  console.log(`${users.length} usuarios creados exitosamente.`);
  if (users.length === 0) {
      throw new Error('Fallo crítico: No se pudo crear ningún usuario de prueba.');
  }

  // Retorna los datos necesarios para la prueba principal.
  return { users, productId };
}

// --- ESCENARIO DE PRUEBA PRINCIPAL ---
export default function (data) {
  // Cada usuario virtual (VU) elige un usuario de la lista.
  const userIndex = __VU % data.users.length;
  const currentUser = data.users[userIndex];

  // 1. Visita a la Página Principal
  http.get(`${BASE_URL}/api/products`);
  sleep(1);

  // 2. Iniciar Sesión
  const loginRes = http.post(`${BASE_URL}/api/login`, JSON.stringify(currentUser), { headers });
  check(loginRes, { 'Login exitoso': (r) => r.status === 200 });
  const userToken = loginRes.json('token');
  sleep(1);

  // 3. Flujo de Compra
  if (userToken) {
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`,
    };
    const checkoutPayload = JSON.stringify({
      total: 49.99,
      items: [{ id: data.productId, quantity: 1, price_base: 49.99 }], // Usa el ID del producto creado en setup.
    });
    const checkoutRes = http.post(`${BASE_URL}/api/orden_compra`, checkoutPayload, { headers: authHeaders });
    check(checkoutRes, { 'Creación de orden exitosa': (r) => r.status === 201 });
  }
  sleep(2);
}

// --- FUNCIÓN DE TEARDOWN: Se ejecuta una sola vez al final ---
// Limpia los datos creados durante la prueba.
export function teardown(data) {
    console.log('Limpiando datos de prueba...');
    
    const adminLoginPayload = JSON.stringify({ email: 'admin@urbanstyle.com', password: 'admin123' });
    const adminRes = http.post(`${BASE_URL}/api/login`, adminLoginPayload, { headers });
    const adminToken = adminRes.json('token');

    if (adminToken) {
        const authHeaders = { 'Authorization': `Bearer ${adminToken}` };
        // Elimina el producto creado.
        http.del(`${BASE_URL}/api/products/${data.productId}`, null, { headers: authHeaders });
        console.log(`Producto con ID ${data.productId} eliminado.`);
    }
    // Nota: Los usuarios no se eliminan para no añadir carga extra, pero gracias al email único no interferirán en futuras pruebas.
}