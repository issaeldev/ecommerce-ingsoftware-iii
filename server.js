const express = require('express');
const app = express();
const cors = require('cors');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const jwt = require('jsonwebtoken');
const SECRET = 'tu_clave_secreta';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

//Base de datos SQLite
const db = new sqlite3.Database('./database.sqlite');

//Login y Rrgistro
app.post('/api/register', (req, res) => {
    const { name, lastname, email, password, document_type, document_number, phone } = req.body;
    if (!email || !password || !name || !lastname || !document_type || !document_number || !phone) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }
    const hashed = bcrypt.hashSync(password, 10);
    const sql = `INSERT INTO users (email, password, name, lastname, document_type, document_number, phone) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const params = [email, hashed, name, lastname, document_type, document_number, phone];
    db.run(sql, params, function (err) {
        if (err) {
            return res.status(400).json({ error: 'Error al registrar usuario o usuario ya existe' });
        }
        res.json({ success: true });
    });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err || !user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
        }
        const token = jwt.sign({ id: user.id, email: user.email, isAdmin: !!user.isAdmin }, SECRET, { expiresIn: '2h' });
        res.json({ success: true, token, isAdmin: !!user.isAdmin });
    });
});

//Crud de productos
app.get('/api/products', (req, res) => {
    db.all('SELECT * FROM products', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/products', authenticateToken, (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'No autorizado' });
    }
    const { name, description, category, gender, colors_json, sizes, price_base, image } = req.body;
    const sizesText = Array.isArray(sizes) ? sizes.join(',') : sizes;
    const stock = 1;
    const sku = `${name.slice(0, 3).toUpperCase()}-${gender[0]}-${Math.floor(Math.random() * 10000)}`;
    const sql = `INSERT INTO products (name, description, category, gender, colors_json, sizes, price_base, stock, sku, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [name, description, category, gender, colors_json, sizesText, price_base, stock, sku, image];
    db.run(sql, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID, sku });
    });
});

app.put('/api/products/:id', authenticateToken, (req, res) => {
    if (!req.user.isAdmin) return res.status(403).json({ error: 'No autorizado' });
    const { name, description, category, gender, colors_json, sizes, price_base, stock, image } = req.body;
    db.run('UPDATE products SET name=?, description=?, category=?, gender=?, colors_json=?, sizes=?, price_base=?, stock=?, image=? WHERE id=?',
        [name, description, category, gender, colors_json, sizes, price_base, stock, image, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

app.delete('/api/products/:id', authenticateToken, (req, res) => {
    if (!req.user.isAdmin) return res.status(403).json({ error: 'No autorizado' });
    db.run('DELETE FROM products WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json({ success: true });
    });
});

//Orden de compra
app.get('/api/orden_compra', authenticateToken, (req, res) => {
    if (!req.user.isAdmin) {
        const userId = req.user.id;
        db.all('SELECT * FROM orden_compra WHERE id_usuario = ? ORDER BY id DESC', [userId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    } else {
        db.all('SELECT * FROM orden_compra ORDER BY id DESC', [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    }
});

//Detalle de compra y Mis Compras
app.get('/api/detalle_compra', authenticateToken, (req, res) => {
  let sql = `
    SELECT
        dc.id_orden, 
        oc.fecha,
        dc.id_producto, 
        p.name AS nombre_producto,
        p.gender AS genero,
        p.sizes AS talla,
        dc.cantidad, 
        dc.precio_unitario,
        u.id AS usuario_id, 
        u.name, 
        u.lastname, 
        u.email
    FROM detalle_compra dc
    JOIN orden_compra oc ON dc.id_orden = oc.id
    JOIN products p ON dc.id_producto = p.id
    JOIN users u ON oc.id_usuario = u.id
    `;
  const params = [];

  //Si no es admin, filtra por el ID del usuario que hizo la petición
  if (!req.user.isAdmin) {
    sql += ' WHERE oc.id_usuario = ?';
    params.push(req.user.id);
  }

  sql += ' ORDER BY dc.id_orden DESC, p.name ASC';

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});


//Registrar nueva orden de compra
app.post('/api/orden_compra', authenticateToken, (req, res) => {
  const loggedInUserId = req.user.id; 
  const { total, items } = req.body;
  if (!loggedInUserId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Faltan datos para crear la orden.' });
  }
  const fecha = new Date().toISOString();
  db.run('INSERT INTO orden_compra (fecha, id_usuario, total) VALUES (?, ?, ?)',
    [fecha, loggedInUserId, total], 
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error al registrar la orden principal.'});
      }
      const orderId = this.lastID;
      const stmt = db.prepare('INSERT INTO detalle_compra (id_orden, id_producto, cantidad, precio_unitario) VALUES (?, ?, ?, ?)');
      items.forEach(item => {
        stmt.run(orderId, item.id, item.quantity || 1, item.price_base);
      });
      stmt.finalize((err) => {
          if (err) return res.status(500).json({ error: "Error al insertar los detalles." });
          res.status(201).json({ message: 'Orden creada exitosamente', orderId: orderId });
      });
    });
});

//Servidor
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Token faltante" });
    jwt.verify(token, SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Token inválido" });
        req.user = user;
        next();
    });
}
module.exports = { app, db, server };