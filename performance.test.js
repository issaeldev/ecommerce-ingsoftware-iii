import http from 'k6/http';
import { check, sleep, group } from 'k6';

// --- CONFIGURACIÓN DE LA PRUEBA (Sin cambios) ---
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
let testUsers = []; // Array para almacenar los usuarios de prueba

// --- FUNCIÓN DE SETUP: Se ejecuta una sola vez al inicio ---
// Aquí creamos los usuarios que se usarán durante la prueba.
export function setup() {
  console.log('Creando usuarios de prueba...');
  const users = [];
  for (let i = 0; i < 20; i++) { // Creamos 20 usuarios
    const userEmail = `setup_user_${i}@test.com`;
    const password = 'testpassword123';
    
    const registerPayload = JSON.stringify({
      email: userEmail, password, name: 'Setup', lastname: 'User',
      document_type: 'DNI', document_number: '12345678', phone: '987654321',
    });
    const headers = { 'Content-Type': 'application/json' };
    
    const res = http.post(`${BASE_URL}/api/register`, registerPayload, { headers });
    
    // Verificamos que el registro fue exitoso antes de añadir el usuario a la lista.
    if (res.status === 200) {
      users.push({ email: userEmail, password: password });
    }
  }
  console.log(`${users.length} usuarios creados exitosamente.`);
  return { users }; // Pasamos los usuarios creados a la función principal.
}

// --- ESCENARIO DE PRUEBA PRINCIPAL ---
export default function (data) {
  // Cada usuario virtual (VU) elige un usuario de la lista creada en setup.
  const userIndex = __VU % data.users.length;
  const currentUser = data.users[userIndex];

  // 1. Visita a la Página Principal
  group('1. Cargar Productos', function () {
    const res = http.get(`${BASE_URL}/api/products`);
    check(res, { 'Carga de productos exitosa': (r) => r.status === 200 });
  });
  sleep(1);

  let userToken;

  // 2. Iniciar Sesión
  group('2. Iniciar Sesión', function () {
    const loginPayload = JSON.stringify(currentUser);
    const headers = { 'Content-Type': 'application/json' };
    const loginRes = http.post(`${BASE_URL}/api/login`, loginPayload, { headers });
    
    check(loginRes, {
      'Login exitoso': (r) => r.status === 200,
      'Token recibido': (r) => r.json('token') !== '',
    });

    if (loginRes.json('token')) {
      userToken = loginRes.json('token');
    }
  });
  sleep(1);

  // 3. Flujo de Compra
  if (userToken) {
    group('3. Realizar Compra', function () {
      const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      };
      
      const checkoutPayload = JSON.stringify({
        total: 49.99,
        items: [{ id: 1, quantity: 1, price_base: 49.99 }],
      });

      const checkoutRes = http.post(`${BASE_URL}/api/orden_compra`, checkoutPayload, { headers: authHeaders });
      check(checkoutRes, { 'Creación de orden exitosa': (r) => r.status === 201 });
    });
  }
  sleep(2);
}