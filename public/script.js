document.addEventListener('DOMContentLoaded', () => {
    let allProducts = [];

    //Manejode sesión de usuario y navegación
    const user = JSON.parse(sessionStorage.getItem('user'));
    
    //Referencias a lso archivos de lectura
    const loginLink = document.getElementById('loginLink');
    const registerLink = document.getElementById('registerLink');
    const logoutLink = document.getElementById('logoutLink');
    const adminLink = document.getElementById('adminLink');
    const ordenesLink = document.getElementById('ordenesLink');
    const reportesLink = document.getElementById('reportesLink');
    const misComprasLink = document.getElementById('misComprasLink'); 

    if (user) {
        if (loginLink) loginLink.style.display = 'none';
        if (registerLink) registerLink.style.display = 'none';

        if (logoutLink) {
            logoutLink.style.display = 'list-item';
            logoutLink.addEventListener('click', (e) => {
                e.preventDefault();
                sessionStorage.removeItem('user');
                localStorage.removeItem('cart'); 
                window.location.href = 'index.html';
            });
        }
        
        // Muestra los enlaces según el tipo de usuario
        if (user.isAdmin) {
            //Admin: muestra enlaces de admin
            if (adminLink) adminLink.style.display = 'list-item';
            if (ordenesLink) ordenesLink.style.display = 'list-item';
            if (reportesLink) reportesLink.style.display = 'list-item';
        } else {
            //Usuario Común: muestra "Mis Compras"
            if (misComprasLink) misComprasLink.style.display = 'list-item';
        }

    } else { //Si el usuario NO ha iniciado sesión
        if (loginLink) loginLink.style.display = 'list-item';
        if (registerLink) registerLink.style.display = 'list-item';
        if (logoutLink) logoutLink.style.display = 'none';
        if (adminLink) adminLink.style.display = 'none';
        if (ordenesLink) ordenesLink.style.display = 'none';
        if (reportesLink) reportesLink.style.display = 'none';
        if (misComprasLink) misComprasLink.style.display = 'none';
    }

    //Lógica del catálogo de productos y filtros
    const productsContainer = document.getElementById('products-container');
    if (productsContainer) {
        
        async function initializeCatalog() {
            try {
                const res = await fetch('/api/products');
                if (!res.ok) throw new Error('No se pudo cargar los productos.');
                allProducts = await res.json();
                renderProducts(allProducts);
                setupFilters();
            } catch (error) {
                productsContainer.innerHTML = `<p style="text-align:center;">Error al cargar productos: ${error.message}</p>`;
            }
        }

        function renderProducts(products) {
            productsContainer.innerHTML = '';
            const noResultsMessage = document.getElementById('no-results-message');

            if (products.length === 0) {
                if (noResultsMessage) noResultsMessage.style.display = 'block';
                return;
            }

            if (noResultsMessage) noResultsMessage.style.display = 'none';

            products.forEach(product => {
                const productDiv = document.createElement('div');
                productDiv.className = 'product';
                productDiv.setAttribute('data-gender', product.gender);
                productDiv.setAttribute('data-category', product.category);

                const colors = JSON.parse(product.colors_json || '[]');
                const colorBoxes = colors.map(color => `<div class="color-box selectable-color" style="background-color: ${color.code}" data-name="${color.name}" data-code="${color.code}" title="${color.name}"></div>`).join('');
                const sizes = String(product.sizes || '').split(',');
                const sizeBoxes = sizes.map(size => `<div class="size-box selectable-size" data-size="${size}">${size}</div>`).join('');

                productDiv.innerHTML = `
                    <img src="${product.image}" alt="${product.name}">
                    <h3>${product.name}</h3>
                    <div><strong>Colores:</strong> <div class="d-flex">${colorBoxes}</div></div>
                    <div><strong>Tallas:</strong> <div class="d-flex">${sizeBoxes}</div></div>
                    <p class="price">S/ ${(product.price_base || 0).toFixed(2)}</p>
                    <button class="add-to-cart-btn" disabled>Agregar al carrito</button>
                `;

                let selectedColor = null, selectedSize = null;
                const addButton = productDiv.querySelector('.add-to-cart-btn');

                function toggleAddButton() { addButton.disabled = !(selectedColor && selectedSize); }

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
                addButton.addEventListener('click', () => {
                    if (selectedColor && selectedSize) addToCart({ ...product, selectedColor, selectedSize, quantity: 1 });
                });
                productsContainer.appendChild(productDiv);
            });
        }
        
        function applyFilters() {
            const selectedGenderBtn = document.querySelector('.filter-option[data-filter-type="gender"].selected');
            const selectedCategoryBtn = document.querySelector('.filter-option[data-filter-type="category"].selected');
            const genderFilter = selectedGenderBtn ? selectedGenderBtn.dataset.filterValue : 'all';
            const categoryFilter = selectedCategoryBtn ? selectedCategoryBtn.dataset.filterValue : 'all';
            const filteredProducts = allProducts.filter(product => {
                const genderMatch = (genderFilter === 'all') || (product.gender === genderFilter);
                const categoryMatch = (categoryFilter === 'all') || (product.category === categoryFilter);
                return genderMatch && categoryMatch;
            });
            renderProducts(filteredProducts);
        }

        function setupFilters() {
            const filterControls = document.querySelector('[data-testid="filter-controls"]');
            if (!filterControls) return;
            const categorias = { Hombre: ["Polo", "Camisa", "Camiseta", "Polo Manga Cero", "Casaca", "Polera", "Blazer", "Saco", "Chaleco", "Pantalón", "Jeans", "Short"], Mujer: ["Polo", "Blusa", "Top", "Camiseta", "Polo Manga Cero", "Casaca", "Polera", "Blazer", "Saco", "Chaleco", "Pantalón", "Jeans", "Short", "Falda", "Leggins"] };
            const categoryContainer = document.getElementById('category-filter-options');
            filterControls.addEventListener('click', (event) => {
                const target = event.target;
                if (!target.matches('.filter-option')) return;
                const type = target.dataset.filterType;
                document.querySelectorAll(`.filter-option[data-filter-type="${type}"]`).forEach(btn => btn.classList.remove('selected'));
                target.classList.add('selected');
                if (type === 'gender') {
                    const selectedGender = target.dataset.filterValue;
                    categoryContainer.innerHTML = '<button class="filter-option selected" data-filter-type="category" data-filter-value="all" data-testid="filter-category-all">Todas</button>';
                    if (categorias[selectedGender]) {
                        categorias[selectedGender].forEach(cat => {
                            const catButton = document.createElement('button');
                            catButton.className = 'filter-option';
                            catButton.dataset.filterType = 'category';
                            catButton.dataset.filterValue = cat;
                            catButton.dataset.testid = `filter-category-${cat.toLowerCase()}`;
                            catButton.textContent = cat;
                            categoryContainer.appendChild(catButton);
                        });
                    }
                }
                applyFilters();
            });
        }
        initializeCatalog();
    }

    //Lógica del carrito
    updateCartCount();

    //Manejo del Login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                if (data.success) {
                    sessionStorage.setItem('user', JSON.stringify(data));
                    window.location.href = 'index.html';
                } else {
                    alert(data.error || 'Error al iniciar sesión');
                }
            } catch (err) {
                alert('Ocurrió un error de red. Inténtalo de nuevo.');
            }
        });
    }

    //Lógica del menú
    const hamburger = document.getElementById('hamburger-menu');
    const mobileNav = document.getElementById('mobile-nav');
    const navCenter = document.querySelector('.nav-center ul');
    const navRight = document.querySelector('.nav-right ul');

    if (hamburger && mobileNav && navCenter && navRight) {
        mobileNav.innerHTML = `<ul>${navCenter.innerHTML}${navRight.innerHTML}</ul>`;
        hamburger.addEventListener('click', () => {
            mobileNav.classList.toggle('active');
        });
    }
});

//Funcionea Globales
function updateCartCount() {
    const cartCountEl = document.getElementById("cartCount");
    if (!cartCountEl) return;
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    cartCountEl.textContent = cart.reduce((total, item) => total + (item.quantity || 1), 0);
}

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
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
}