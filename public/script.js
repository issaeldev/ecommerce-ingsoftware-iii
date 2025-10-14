
function updateCartCount() {
    const cartCountEl = document.getElementById("cartCount");
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    let totalItems = 0;
    cart.forEach(item => {
        totalItems += item.quantity ? item.quantity : 1;
    });
    if (cartCountEl) {
        cartCountEl.textContent = totalItems;
    }
}



document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(sessionStorage.getItem('user'));

    
    // Ocultar "Iniciar sesión" y "Registrarse" si ya hay sesión iniciada
    const loginLink = document.querySelector('a[href="login.html"]');
    const registerLink = document.querySelector('a[href="register.html"]');
    if (user) {
        if (loginLink) loginLink.style.display = 'none';
        if (registerLink) registerLink.style.display = 'none';
    }


    // Mostrar enlace "Cerrar sesión" si hay usuario logueado
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink && user) {
        logoutLink.style.display = 'list-item';
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            sessionStorage.removeItem('user');
            window.location.href = 'index.html';
        });
    }


    // Mostrar enlace "Gestionar" si es administrador
    const adminLink = document.getElementById('adminLink');
    if (adminLink && user && user.isAdmin) {
        adminLink.style.display = 'list-item';
    }

    const path = window.location.pathname;

    // Protege el admin.html
    if (path.includes('admin.html')) {
        if (!user || !user.isAdmin) {
            alert('Acceso denegado');
            window.location.href = 'index.html';
        }
    }

    // Login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (data.success) {
                // Store user data with isAdmin property accessible
                const userData = {
                    success: data.success,
                    token: data.token,
                    isAdmin: data.isAdmin
                };
                sessionStorage.setItem('user', JSON.stringify(userData));
                window.location.href = 'index.html';
            } else {
                alert(data.error || 'Error al iniciar sesión');
            }
        });
    }

    // Registro
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;

            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();
            if (data.success) {
                alert('Usuario registrado. Inicia sesión.');
                window.location.href = 'login.html';
            } else {
                alert(data.error || 'Error al registrarse');
            }
        });
    }

    // Mostrar productos en el catálogo
    async function loadProducts() {
        const res = await fetch('/api/products');
        const products = await res.json();
        const container = document.getElementById('products');
        if (!container) return;
        container.innerHTML = '';

        products.forEach(product => {
            const productDiv = document.createElement('div');
            productDiv.className = 'product';

            // Colores
            const colors = JSON.parse(product.colors_json || '[]');
            const colorBoxes = colors.map(color => 
                `<div class="color-box selectable-color" 
                    style="background-color: ${color.code}" 
                    data-name="${color.name}" 
                    data-code="${color.code}" 
                    title="${color.name}"></div>`
            ).join('');

            // Tallas
            const sizes = Array.isArray(product.sizes) ? product.sizes : String(product.sizes).split(',');
            const sizeBoxes = sizes.map(size =>
                `<div class="size-box selectable-size" data-size="${size}">${size}</div>`
            ).join('');

            productDiv.innerHTML = `
                <img src="${product.image}" alt="${product.name}">
                <h3>${product.name}</h3>
                <div><strong>Colores:</strong> ${colorBoxes}</div>
                <div><strong>Tallas:</strong> ${sizeBoxes}</div>
                <p class="price">S/ ${(product.price_base || 0).toFixed(2)}</p>
                <button class="add-to-cart-btn" disabled>Agregar al carrito</button>
            `;

            // Manejo de selección
            let selectedColor = null;
            let selectedSize = null;

            productDiv.querySelectorAll('.selectable-color').forEach(box => {
                box.addEventListener('click', () => {
                    productDiv.querySelectorAll('.selectable-color').forEach(b => b.classList.remove('selected'));
                    box.classList.add('selected');
                    selectedColor = { name: box.dataset.name, code: box.dataset.code };
                    toggleAddButton();
                });
            });

            productDiv.querySelectorAll('.selectable-size').forEach(box => {
                box.addEventListener('click', () => {
                    productDiv.querySelectorAll('.selectable-size').forEach(b => b.classList.remove('selected'));
                    box.classList.add('selected');
                    selectedSize = box.dataset.size;
                    toggleAddButton();
                });
            });

            function toggleAddButton() {
                const btn = productDiv.querySelector('.add-to-cart-btn');
                btn.disabled = !(selectedColor && selectedSize);
            }

            productDiv.querySelector('.add-to-cart-btn').addEventListener('click', () => {
                if (selectedColor && selectedSize) {
                    const selected = {
                        ...product,
                        selectedColor,
                        selectedSize
                    };
                    addToCart(selected);
                }
            });

            container.appendChild(productDiv);
        });
    };
    
        
        

    if (document.getElementById('products')) {
        loadProducts();
    }

    // Añadir producto desde el admin
    const productForm = document.getElementById('productForm');
    if (productForm) {
        productForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const newProduct = {
                name: document.getElementById('name').value,
                color: document.getElementById('color').value,
                gender: document.getElementById('gender').value,
                sizes: document.getElementById('sizes').value.split(',').map(s => s.trim()),
                price: parseFloat(document.getElementById('price').value),
                image: document.getElementById('image').value
            };

            if (!user || !user.token) {
                alert('No autorizado');
                return;
            }

            const res = await fetch('/api/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify(newProduct)
            });

            const data = await res.json();
            if (data.success) {
                alert('Producto añadido con éxito');
                productForm.reset();
            } else {
                alert(data.error || 'Error al añadir producto');
            }
        });
    }
});

function addToCart(item) {
const cart = JSON.parse(localStorage.getItem('cart')) || [];
    cart.push(item);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    
    showToast('Agregaste una prenda al carrito');
}


function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
    } else {
        toast.textContent = message;
    }
    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}




function applyFilters() {
    const gender = document.getElementById("filterGender").value;
    const category = document.getElementById("filterCategory").value;

    const filtered = allProducts.filter(p => {
        const genderMatch = gender === "all" || p.gender === gender;
        const categoryMatch = category === "all" || p.category === category;
        return genderMatch && categoryMatch;
    });

    renderFilteredProducts(filtered);
}

function renderFilteredProducts(products) {
    const container = document.getElementById('products');
    if (!container) return;
    container.innerHTML = '';

    // Si no hay productos, mostrar un mensaje
    if (products.length === 0) {
        container.innerHTML = '<p style="text-align:center; font-weight:bold; padding: 20px;">No se encontraron prendas para los filtros seleccionados.</p>';
        return;
    }

    products.forEach(product => {
        const productDiv = document.createElement('div');
        productDiv.className = 'product';

        const colors = JSON.parse(product.colors_json || '[]');
        const colorBoxes = colors.map(color => 
            `<div class="color-box selectable-color" 
                style="background-color: ${color.code}" 
                data-name="${color.name}" 
                data-code="${color.code}" 
                title="${color.name}"></div>`
        ).join('');

        const sizes = Array.isArray(product.sizes) ? product.sizes : String(product.sizes).split(',');
        const sizeBoxes = sizes.map(size =>
            `<div class="size-box selectable-size" data-size="${size}">${size}</div>`
        ).join('');

        productDiv.innerHTML = `
            <img src="${product.image}" alt="${product.name}">
            <h3>${product.name}</h3>
            <div><strong>Colores:</strong> ${colorBoxes}</div>
            <div><strong>Tallas:</strong> ${sizeBoxes}</div>
            <p class="price">S/ ${(product.price_base || 0).toFixed(2)}</p>
            <button class="add-to-cart-btn" disabled>Agregar al carrito</button>
        `;

        let selectedColor = null;
        let selectedSize = null;

        productDiv.querySelectorAll('.selectable-color').forEach(box => {
            box.addEventListener('click', () => {
                productDiv.querySelectorAll('.selectable-color').forEach(b => b.classList.remove('selected'));
                box.classList.add('selected');
                selectedColor = { name: box.dataset.name, code: box.dataset.code };
                toggleAddButton();
            });
        });

        productDiv.querySelectorAll('.selectable-size').forEach(box => {
            box.addEventListener('click', () => {
                productDiv.querySelectorAll('.selectable-size').forEach(b => b.classList.remove('selected'));
                box.classList.add('selected');
                selectedSize = box.dataset.size;
                toggleAddButton();
            });
        });

        function toggleAddButton() {
            const btn = productDiv.querySelector('.add-to-cart-btn');
            btn.disabled = !(selectedColor && selectedSize);
        }

        productDiv.querySelector('.add-to-cart-btn').addEventListener('click', () => {
            if (selectedColor && selectedSize) {
                const selected = {
                    ...product,
                    selectedColor,
                    selectedSize
                };
                addToCart(selected);
            }
        });

        container.appendChild(productDiv);
    });
}


let allProducts = [];
window.loadProducts = async function() {
    const res = await fetch('/api/products');
    allProducts = await res.json();
    renderFilteredProducts(allProducts);
}

document.addEventListener('DOMContentLoaded', () => loadProducts());