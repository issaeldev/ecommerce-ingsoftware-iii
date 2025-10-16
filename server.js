
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

// Base de datos SQLite
const db = new sqlite3.Database('./database.sqlite');

// Registro
app.post('/api/register', (req, res) => {
    const { name, lastname, email, password, document_type, document_number, phone } = req.body;

    if (!email || !password || !name || !lastname || !document_type || !document_number || !phone) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    const hashed = bcrypt.hashSync(password, 10);

    const sql = `
        INSERT INTO users (email, password, name, lastname, document_type, document_number, phone)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [email, hashed, name, lastname, document_type, document_number, phone];

    db.run(sql, params, function (err) {
        if (err) {
            console.error("Error al registrar:", err.message);
            return res.status(400).json({ error: 'Error al registrar usuario o usuario ya existe' });
        }
        res.json({ success: true });
    });
});

// Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    // Validar campos requeridos
    if (!email || !password) {
        return res.status(400).json({
            error: 'Todos los campos son obligatorios',
            details: !email ? 'El campo correo es obligatorio' : 'El campo contraseña es obligatorio'
        });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) {
            console.error('Error en base de datos:', err);
            return res.status(500).json({ error: 'Error interno del servidor' });
        }

        // Usuario no encontrado
        if (!user) {
            return res.status(401).json({
                error: 'El correo electrónico no está registrado',
                field: 'email'
            });
        }

        // Contraseña incorrecta
        if (!bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({
                error: 'La contraseña es incorrecta',
                field: 'password'
            });
        }

        const token = jwt.sign({
            id: user.id,
            email: user.email,
            isAdmin: !!user.isAdmin
        }, SECRET, { expiresIn: '2h' });

        console.log(`Login exitoso para: ${user.email}, isAdmin: ${!!user.isAdmin}`);
        res.json({ success: true, token, isAdmin: !!user.isAdmin });
    });
});


// CRUD productos
app.get('/api/products', (req, res) => {
    db.all('SELECT * FROM products', [], (err, rows) => {
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

    const sql = `
        INSERT INTO products (name, description, category, gender, colors_json, sizes, price_base, stock, sku, image)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [name, description, category, gender, colors_json, sizesText, price_base, stock, sku, image];

    db.run(sql, params, function (err) {
        if (err) {
            console.error("Error al insertar producto:", err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log("Producto insertado con SKU:", sku);
        res.json({ success: true, id: this.lastID, sku });
    });
});




app.put('/api/products/:id', (req, res) => {
    const { name, description, category, gender, colors_json, sizes, price_base, stock, image } = req.body;
    const id = req.params.id;

    db.run(
        'UPDATE products SET name=?, description=?, category=?, gender=?, colors_json=?, sizes=?, price_base=?, stock=?, image=? WHERE id=?',
        [name, description, category, gender, colors_json, sizes, price_base, stock, image, id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});



app.delete('/api/products/:id', authenticateToken, (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'No autorizado' });
    }

    const productId = req.params.id;
    db.run('DELETE FROM products WHERE id = ?', [productId], function (err) {
        if (err) {
            console.error("Error al eliminar producto:", err.message);
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json({ success: true });
    });
});

// Orden de compra
app.get('/api/orden_compra', authenticateToken, (req, res) => {
    console.log('LLEGA POST ORDEN', req.body);
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'No autorizado. Solo el admin puede acceder.' });
    }
    db.all('SELECT * FROM orden_compra', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Detalle de compra
app.get('/api/detalle_compra', (req, res) => {
    db.all('SELECT * FROM detalle_compra', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Registrar nueva orden de compra y sus detalles
app.post('/api/orden_compra', authenticateToken, (req, res) => {
    const { id_usuario, total, items } = req.body;
    db.run(
        'INSERT INTO orden_compra (fecha, id_usuario, total) VALUES (?, ?, ?)',
        [new Date().toISOString(), id_usuario, total],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const ordenId = this.lastID;
            let errors = [];
            items.forEach(item => {
                db.run(
                    'INSERT INTO detalle_compra (id_orden, id_producto, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
                    [ordenId, item.id, item.quantity, item.price_base],
                    function(e) {
                        if (e) errors.push(e.message);
                    }
                );
            });
            if (errors.length) return res.status(500).json({ error: errors });
            res.json({ success: true });
        }
    );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));


function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        console.warn('TOKEN FALTANTE');
        return res.status(401).json({ error: "Token faltante" });
    }
    jwt.verify(token, SECRET, (err, user) => {
        if (err) {
            console.warn('TOKEN INVÁLIDO', token);
            return res.status(403).json({ error: "Token inválido" });
        }
        console.log('Usuario autenticado:', user);
        req.user = user;
        next();
    });
}
module.exports = app;