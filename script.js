//Partie -1 Setup initial et authentification
// Configuration et variables globales
const API_URL = window.location.origin + '/api';
let basePrice = 0;
let lastUpdateDate = new Date();
let photos = [];
let selectedPhotos = new Set();
let familles = [];
let currentFamilleFilter = 'TOUS';
let currentUser = null;
let userToken = null;
let temporaryBasePrice = null;
let lastScrollTop = 0;

// Styles dynamiques
const styles = `
.no-photos {
    text-align: center;
    padding: 2rem;
    color: #666;
    font-size: 1.2rem;
    background: #f5f5f5;
    border-radius: 8px;
    margin: 1rem 0;
}

.photo-image-container.error {
    background: #f8d7da;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
}

.photo-image-container.error::after {
    content: "Erreur de chargement";
    color: #721c24;
}

.auth-buttons {
    display: flex;
    gap: 10px;
    align-items: center;
}

.user-info {
    display: flex;
    align-items: center;
    gap: 10px;
    color: white;
    padding: 0 15px;
}

.admin-badge {
    background: #ffd700;
    color: #333;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.7rem;
}
`;

// Ajout des styles au document
const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

// Fonctions d'authentification
/*
async function checkAuth() {
    userToken = localStorage.getItem('token');
    if (!userToken) {
        window.location.href = '/login.html';
        return false;
    }

    try {
        const response = await fetch(`${API_URL}/auth/verify`, {
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Session expirée');
        }

        const userData = await response.json();
        currentUser = userData;
        updateUIBasedOnRole();
        return true;
    } catch (error) {
        console.error('Erreur d\'authentification:', error);
        localStorage.removeItem('token');
        window.location.href = '/login.html';
        return false;
    }
}
*/
async function checkAuth() {
    try {
        userToken = localStorage.getItem('token');
        if (!userToken) {
            throw new Error('Token non trouvé');
        }

        const response = await fetch(`${API_URL}/auth/verify`, {
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Erreur d\'authentification');
        }

        const userData = await response.json();
        if (!userData) {
            throw new Error('Données utilisateur invalides');
        }

        currentUser = userData;
        updateUIBasedOnRole();
        return true;
    } catch (error) {
        console.error('Erreur d\'authentification:', error);
        localStorage.removeItem('token');
        showMessage(error.message || 'Erreur lors de l\'authentification', true);
        window.location.href = '/login.html';
        return false;
    }
}




function updateUIBasedOnRole() {
    const isAdmin = currentUser?.role === 'admin';
    
    // Mise à jour des boutons d'action
    document.querySelectorAll('.edit-photo, .delete-photo, #addPhotoBtn').forEach(button => {
        button.style.display = isAdmin ? 'block' : 'none';
    });

    // Mise à jour du bouton de prix
    const updatePriceBtn = document.getElementById('updatePriceBtn');
    if (updatePriceBtn) {
        updatePriceBtn.textContent = isAdmin ? 'MAJ prix de base' : 'Modifier prix (temporaire)';
        updatePriceBtn.title = isAdmin ? 
            'Modifier le prix de base dans la base de données' : 
            'Modifier temporairement le prix pour cette session';
    }

    // Ajout des informations utilisateur dans la nav
    updateNavbarUserInfo();
}

function updateNavbarUserInfo() {
    const nav = document.querySelector('nav ul');
    if (!nav) return;

    // Supprimer l'ancien user-info s'il existe
    const existingUserInfo = nav.querySelector('.user-info');
    if (existingUserInfo) {
        existingUserInfo.remove();
    }

    // Créer le nouvel élément user-info
    const userInfo = document.createElement('div');
    userInfo.className = 'user-info';
    userInfo.innerHTML = `
        <span class="contact">${currentUser.email}</span>
        ${currentUser.role === 'admin' ? '<span class="admin-badge">Admin</span>' : ''}
        <button id="logoutBtn" class="button">Déconnexion</button>
    `;

    // Ajouter l'élément à la nav
    nav.appendChild(userInfo);

    // Ajouter l'écouteur d'événement pour la déconnexion
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
}

async function handleLogout() {
    try {
        await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        });
    } catch (error) {
        console.error('Erreur lors de la déconnexion:', error);
    } finally {
        localStorage.removeItem('token');
        temporaryBasePrice = null;
        window.location.href = '/login.html';
    }
}
//Partie -1 ------------------------------------------------------------------------------------------------------
//Partie -2 Gestion prix et photos------------------------------------------------------------------------------------------------------
// Fonctions utilitaires
function formatNumber(number) {
    return new Intl.NumberFormat('fr-FR', {
        useGrouping: true,
        grouping: [3],
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(number).replace(/\s/g, '\u00A0');
}

function calculatePrice(weight) {
    const currentPrice = temporaryBasePrice || basePrice;
    return currentPrice * weight * 655.957;
}

function isValidCloudinaryUrl(url) {
    return url && (
        url.includes('res.cloudinary.com') || 
        url.includes('cloudinary.com')
    );
}

// Gestion des prix
async function updateBasePrice() {
    const isAdmin = currentUser?.role === 'admin';
    const currentPrice = temporaryBasePrice || basePrice;
    const newBasePrice = parseFloat(prompt("Entrez le nouveau prix de base (pour 1 gramme en F CFA):", (currentPrice * 655.957).toFixed(2)));
    
    if (!isNaN(newBasePrice) && newBasePrice > 0) {
        try {
            toggleLoading(true);
            
            if (isAdmin) {
                // Mise à jour permanente dans la base de données
                const response = await fetch(`${API_URL}/prix-base`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${userToken}`
                    },
                    body: JSON.stringify({
                        prix_gramme: newBasePrice / 655.957
                    })
                });
                
                if (!response.ok) throw new Error('Erreur lors de la mise à jour du prix');
                await fetchLatestBasePrice();
            } else {
                // Mise à jour temporaire pour la session
                temporaryBasePrice = newBasePrice / 655.957;
                basePrice = temporaryBasePrice;
                await renderPhotos();
            }
            
            showMessage(`Nouveau prix de base : ${newBasePrice.toFixed(2)} F CFA pour 1 gramme${!isAdmin ? ' (temporaire)' : ''}`);
        } catch (error) {
            showMessage(error.message, true);
        } finally {
            toggleLoading(false);
        }
    } else {
        showMessage("Veuillez entrer un prix valide.", true);
    }
}

async function fetchLatestBasePrice() {
    try {
        toggleLoading(true);
        // Si un prix temporaire existe et l'utilisateur n'est pas admin, l'utiliser
        if (temporaryBasePrice && currentUser?.role !== 'admin') {
            basePrice = temporaryBasePrice;
            return;
        }

        const response = await fetch(`${API_URL}/prix-base/recent`);
        if (!response.ok) throw new Error('Erreur lors de la récupération du prix');
        
        const data = await response.json();
        if (data && data.prix_gramme) {
            basePrice = data.prix_gramme;
            lastUpdateDate = new Date(data.date_saisie);
            await renderPhotos();
        }
    } catch (error) {
        console.error('Erreur fetchLatestBasePrice:', error);
        showMessage(error.message, true);
    } finally {
        toggleLoading(false);
    }
}

// Gestion des photos
async function fetchPhotos() {
    try {
        toggleLoading(true);
        
        let url = `${API_URL}/photos`;
        if (currentFamilleFilter && currentFamilleFilter !== 'TOUS') {
            url += `?famille=${encodeURIComponent(currentFamilleFilter)}`;
        }
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la récupération des photos');
        }
        
        photos = await response.json();
        await renderPhotos();
        
    } catch (error) {
        console.error('Erreur fetchPhotos:', error);
        showMessage(error.message, true);
    } finally {
        toggleLoading(false);
    }
}

async function addNewPhoto(event) {
    event.preventDefault();
    
    if (currentUser?.role !== 'admin') {
        showMessage('Accès non autorisé', true);
        return;
    }
    
    try {
        const form = document.getElementById('addPhotoForm');
        if (!form) {
            throw new Error("Le formulaire n'a pas été trouvé");
        }

        // Vérification des champs requis
        const requiredFields = {
            'newPhotoName': 'le nom de la photo',
            'newPhotoReference': 'la référence',
            'newPhotoFamille': 'la famille',
            'newPhotoWeight': 'le poids',
            'newPhotoFile': 'la photo'
        };

        for (const [id, fieldName] of Object.entries(requiredFields)) {
            const element = document.getElementById(id);
            if (!element || !element.value) {
                throw new Error(`Veuillez remplir ${fieldName}`);
            }
        }

        const formData = new FormData();
        formData.append('nom_photo', document.getElementById('newPhotoName').value);
        formData.append('reference', document.getElementById('newPhotoReference').value);
        formData.append('famille', document.getElementById('newPhotoFamille').value);
        formData.append('poids_bijou', document.getElementById('newPhotoWeight').value);

        const photoFile = document.getElementById('newPhotoFile').files[0];
        if (photoFile) {
            formData.append('photo', photoFile);
        }

        toggleLoading(true);
        const response = await fetch(`${API_URL}/photos`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || "Erreur lors de l'ajout de la photo");
        }

        await fetchPhotos();
        form.reset();
        document.getElementById('newPhotoPreview').style.display = 'none';
        closeModal('addPhotoModal');
        showMessage('Photo ajoutée avec succès');
    } catch (error) {
        console.error('Erreur dans addNewPhoto:', error);
        showMessage(error.message, true);
    } finally {
        toggleLoading(false);
    }
}

async function updatePhoto(event) {
    event.preventDefault();
    
    if (currentUser?.role !== 'admin') {
        showMessage('Accès non autorisé', true);
        return;
    }

    const photoId = document.getElementById('editPhotoId').value;
    const formData = new FormData();
    
    formData.append('nom_photo', document.getElementById('editPhotoName').value);
    formData.append('reference', document.getElementById('editPhotoReference').value);
    formData.append('famille', document.getElementById('editPhotoFamille').value);
    formData.append('poids_bijou', document.getElementById('editPhotoWeight').value);
    
    const photoFile = document.getElementById('editPhotoFile').files[0];
    if (photoFile) {
        formData.append('photo', photoFile);
    }

    try {
        toggleLoading(true);
        const response = await fetch(`${API_URL}/photos/${photoId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${userToken}`
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Erreur lors de la mise à jour');
        }
        
        await fetchPhotos();
        closeModal('editPhotoModal');
        showMessage('Photo mise à jour avec succès');
    } catch (error) {
        showMessage(error.message, true);
    } finally {
        toggleLoading(false);
    }
}

async function deletePhoto(photoId) {
    if (currentUser?.role !== 'admin') {
        showMessage('Accès non autorisé', true);
        return;
    }

    if (!confirm('Êtes-vous sûr de vouloir supprimer cette photo ?')) {
        return;
    }

    try {
        toggleLoading(true);
        const response = await fetch(`${API_URL}/photos/${photoId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Erreur lors de la suppression');
        }
        
        selectedPhotos.delete(photoId);
        updateClientChoiceButton();
        await fetchPhotos();
        showMessage('Photo supprimée avec succès');
    } catch (error) {
        showMessage(error.message, true);
    } finally {
        toggleLoading(false);
    }
}
//Partie -2 ------------------------------------------------------------------------------------------------------
//Partie -3 Fonction rendu et interface utilisateur------------------------------------------------------------------------------------------------------
// Fonctions de rendu et interface utilisateur
function renderPhotos() {
    const photoGrid = document.getElementById('photoGrid');
    photoGrid.innerHTML = '';
    
    if (!photos || photos.length === 0) {
        photoGrid.innerHTML = '<p class="no-photos">Aucune photo disponible</p>';
        return;
    }

    // Grouper les photos par famille
    const photosByFamille = {};
    photos.forEach(photo => {
        if (!photosByFamille[photo.famille]) {
            photosByFamille[photo.famille] = [];
        }
        photosByFamille[photo.famille].push(photo);
    });

    const famillesContainer = document.createElement('div');
    famillesContainer.className = 'familles-container';

    // Trier les familles par ordre alphabétique
    const sortedFamilles = Object.keys(photosByFamille).sort();

    sortedFamilles.forEach(famille => {
        const familleGroup = document.createElement('div');
        familleGroup.className = 'famille-group';

        const familleHeader = document.createElement('div');
        familleHeader.className = 'famille-header';
        familleHeader.innerHTML = `
            <h2>${famille}</h2>
            <span class="badge">${photosByFamille[famille].length} bijou${photosByFamille[famille].length > 1 ? 'x' : ''}</span>
        `;

        const familleGrid = document.createElement('div');
        familleGrid.className = 'famille-grid';

        photosByFamille[famille].forEach(photo => {
            const photoElement = document.createElement('div');
            photoElement.className = 'photo-item';
            
            // Construction du HTML pour chaque photo avec gestion des permissions
            const adminButtons = currentUser?.role === 'admin' ? `
                <button class="button edit-photo" data-photo-id="${photo._id}">Modifier</button>
                <button class="button delete-photo" data-photo-id="${photo._id}">Supprimer</button>
            ` : '';

            photoElement.innerHTML = `
                <div class="photo-image-container">
                    <input type="checkbox" class="photo-checkbox" data-photo-id="${photo._id}">
                    <img src="${photo.photo_url}" 
                         alt="${photo.nom_photo}"
                         loading="lazy"
                         onerror="this.src='/images/fallback-image.jpg'">
                </div>
                <div class="photo-info">
                    <div class="photo-famille">
                        <p class="photo-name">${photo.famille}</p>
                    </div>
                    <p class="photo-name">Nom: ${photo.nom_photo}</p>
                    <p class="photo-reference">Référence: ${photo.reference}</p>
                    <p class="photo-weight">Poids: ${photo.poids_bijou.toFixed(2)} g</p>
                    <p class="photo-price">Prix: ${formatNumber(Math.round(calculatePrice(photo.poids_bijou)))} F CFA</p>
                </div>
                <div class="photo-actions">
                    <div class="button-container">
                        ${adminButtons}
                        <button class="button view-photo" data-photo-url="${photo.photo_url}">Voir</button>
                    </div>
                </div>
            `;

            familleGrid.appendChild(photoElement);
            addPhotoElementListeners(photoElement, photo);
        });

        familleGroup.appendChild(familleHeader);
        familleGroup.appendChild(familleGrid);
        famillesContainer.appendChild(familleGroup);
    });

    photoGrid.appendChild(famillesContainer);
    initializeStickyFamilleHeaders();
}

function addPhotoElementListeners(element, photo) {
    // Checkbox pour la sélection
    element.querySelector('.photo-checkbox').addEventListener('change', function(e) {
        togglePhotoSelection(e.target, photo._id);
    });

    // Boutons d'administration (seulement si admin)
    if (currentUser?.role === 'admin') {
        element.querySelector('.edit-photo')?.addEventListener('click', function() {
            openEditPhotoModal(photo._id);
        });

        element.querySelector('.delete-photo')?.addEventListener('click', function() {
            deletePhoto(photo._id);
        });
    }

    // Affichage de la photo (pour tous)
    element.querySelector('.view-photo').addEventListener('click', function() {
        showEnlargedPhoto(photo.photo_url);
    });

    element.querySelector('img').addEventListener('dblclick', function() {
        showEnlargedPhoto(photo.photo_url);
    });
}

function initializeStickyFamilleHeaders() {
    const nav = document.querySelector('nav');
    const familleGroups = document.querySelectorAll('.famille-group');
    const stickyHeaders = new Map();
    
    // Nettoyage des anciens headers sticky
    const existingContainer = document.querySelector('.sticky-headers-container');
    if (existingContainer) {
        existingContainer.remove();
    }

    // Création du nouveau conteneur
    const stickyContainer = document.createElement('div');
    stickyContainer.classList.add('sticky-headers-container');
    document.body.appendChild(stickyContainer);

    familleGroups.forEach(group => {
        const header = group.querySelector('.famille-header');
        const grid = group.querySelector('.famille-grid');
        
        const stickyHeader = header.cloneNode(true);
        stickyHeader.classList.add('sticky-famille-header');
        stickyContainer.appendChild(stickyHeader);
        
        stickyHeaders.set(group, {
            original: header,
            sticky: stickyHeader,
            grid: grid
        });
    });

    function updateStickyHeaders() {
        const navHeight = nav.getBoundingClientRect().height;
        
        stickyHeaders.forEach((headers, group) => {
            const { sticky, grid } = headers;
            const groupRect = group.getBoundingClientRect();
            const gridBottom = grid.getBoundingClientRect().bottom;
            
            if (groupRect.top <= navHeight && gridBottom > navHeight) {
                sticky.style.display = 'flex';
                sticky.style.top = `${navHeight}px`;
            } else {
                sticky.style.display = 'none';
            }
        });
    }

    // Mise à jour des headers au scroll et redimensionnement
    window.addEventListener('scroll', updateStickyHeaders);
    window.addEventListener('resize', updateStickyHeaders);
}

function handleStickyNav() {
    const nav = document.querySelector('nav');
    const header = document.querySelector('header');
    const main = document.querySelector('main');
    
    if (!nav || !header || !main) return;
    
    const navigationHeight = nav.offsetHeight;
    const headerBottom = header.offsetTop + header.offsetHeight;
    const currentScroll = window.pageYOffset || document.documentElement.scrollTop;

    document.documentElement.style.setProperty('--scroll-padding', navigationHeight + "px");
    
    if (currentScroll > headerBottom) {
        nav.classList.add('sticky');
        main.style.paddingTop = navigationHeight + 'px';
        
        if (currentScroll > lastScrollTop) {
            header.style.transform = 'translateY(-100%)';
        } else {
            header.style.transform = 'translateY(0)';
        }
    } else {
        nav.classList.remove('sticky');
        main.style.paddingTop = '0';
        header.style.transform = 'translateY(0)';
    }
    
    lastScrollTop = currentScroll;
}

// Gestion des messages et du chargement
function showMessage(message, isError = false) {
    const messageDiv = document.getElementById(isError ? 'errorMessage' : 'successMessage');
    if (!messageDiv) return;

    messageDiv.textContent = message;
    messageDiv.style.display = 'block';
    
    messageDiv.style.opacity = '0';
    messageDiv.style.transform = 'translateY(20px)';
    
    requestAnimationFrame(() => {
        messageDiv.style.transition = 'all 0.3s ease';
        messageDiv.style.opacity = '1';
        messageDiv.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
        messageDiv.style.opacity = '0';
        messageDiv.style.transform = 'translateY(20px)';
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 300);
    }, 5000);
}

function toggleLoading(show) {
    const loading = document.getElementById('loading');
    if (!loading) return;

    loading.style.display = show ? 'flex' : 'none';
    
    if (show) {
        loading.classList.add('fade-in');
    } else {
        loading.classList.remove('fade-in');
    }
}
//Partie -3 ------------------------------------------------------------------------------------------------------
//Partie -4 Gestion modals et formulaires------------------------------------------------------------------------------------------------------
// Gestion des modals et des formulaires
function openModal(modalId) {
    if (!currentUser) {
        showMessage('Veuillez vous connecter pour continuer', true);
        window.location.href = '/login.html';
        return;
    }

    const modal = document.getElementById(modalId);
    if (!modal) return;

    // Vérification des permissions pour certains modals
    if ((modalId === 'addPhotoModal' || modalId === 'editPhotoModal') && currentUser.role !== 'admin') {
        showMessage('Accès non autorisé', true);
        return;
    }

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Réinitialisation des formulaires
    if (modalId === 'addPhotoModal') {
        const form = document.getElementById('addPhotoForm');
        if (form) form.reset();
        
        const preview = document.getElementById('newPhotoPreview');
        if (preview) preview.style.display = 'none';
    }

    requestAnimationFrame(() => {
        modal.style.opacity = '1';
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.transform = 'translateY(0)';
        }
    });
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.style.opacity = '0';
    
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.transform = 'translateY(-20px)';
    }
    
    setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        
        // Réinitialisation des formulaires
        if (modalId === 'addPhotoModal' || modalId === 'editPhotoModal') {
            const formId = modalId === 'addPhotoModal' ? 'addPhotoForm' : 'editPhotoForm';
            const previewId = modalId === 'addPhotoModal' ? 'newPhotoPreview' : 'editPhotoPreview';
            
            const form = document.getElementById(formId);
            const preview = document.getElementById(previewId);
            
            if (form) form.reset();
            if (preview) preview.style.display = 'none';
        }
    }, 300);
}

function openEditPhotoModal(photoId) {
    if (currentUser?.role !== 'admin') {
        showMessage('Accès non autorisé', true);
        return;
    }

    const photo = photos.find(p => p._id === photoId);
    if (!photo) {
        showMessage('Photo non trouvée', true);
        return;
    }

    document.getElementById('editPhotoId').value = photo._id;
    document.getElementById('editPhotoName').value = photo.nom_photo;
    document.getElementById('editPhotoReference').value = photo.reference;
    document.getElementById('editPhotoFamille').value = photo.famille;
    document.getElementById('editPhotoWeight').value = photo.poids_bijou;
    
    const preview = document.getElementById('editPhotoPreview');
    if (preview) {
        preview.src = photo.photo_url;
        preview.style.display = 'block';
    }
    
    openModal('editPhotoModal');
}

function previewImage(input, previewId) {
    const preview = document.getElementById(previewId);
    const container = preview?.parentElement;
    
    if (!preview || !container) {
        console.error('Éléments de prévisualisation non trouvés');
        return;
    }
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            container.classList.add('has-image');
        }
        reader.readAsDataURL(input.files[0]);
    } else {
        preview.src = '';
        preview.style.display = 'none';
        container.classList.remove('has-image');
    }
}

function openClientChoiceModal() {
    const modal = document.getElementById('clientChoiceModal');
    const content = modal.querySelector('.selected-photos');
    content.innerHTML = '';
    let totalPrice = 0;

    selectedPhotos.forEach(photoId => {
        const photo = photos.find(p => p._id === photoId);
        if (photo) {
            const price = Math.round(calculatePrice(photo.poids_bijou));
            totalPrice += price;
            
            const photoElement = document.createElement('div');
            photoElement.className = 'selected-photo-item';
            photoElement.innerHTML = `
                <div class="selected-photo-container">
                    <input type="checkbox" checked onchange="updateClientChoice('${photoId}', this.checked)">
                    <img src="${photo.photo_url}" 
                         alt="${photo.nom_photo}" 
                         loading="lazy"
                         onclick="showEnlargedPhoto('${photo.photo_url}')">
                </div>
                <div class="selected-photo-info">
                    <p class="p-info">${photo.famille}</p>
                    <p>Nom : ${photo.nom_photo}</p>
                    <p>Réf. : ${photo.reference}</p>
                    <p>Poids : ${photo.poids_bijou.toFixed(2)} g</p>
                    <p>Prix : ${formatNumber(price)} F CFA${currentUser?.role !== 'admin' ? ' (prix temporaire)' : ''}</p>
                </div>
            `;
            content.appendChild(photoElement);
        }
    });

    document.getElementById('totalPrice').textContent = formatNumber(totalPrice);
    document.getElementById('paymentAmount').value = '';
    document.getElementById('paymentPeriod').value = 'monthly';
    calculatePaymentPlan();

    openModal('clientChoiceModal');
}

function showEnlargedPhoto(photoUrl) {
    if (!photoUrl) {
        showMessage("L'URL de l'image est invalide", true);
        return;
    }

    const enlargedPhoto = document.getElementById('enlargedPhoto');
    if (enlargedPhoto) {
        enlargedPhoto.src = photoUrl;
        enlargedPhoto.onerror = function() {
            this.onerror = null;
            this.src = '/images/fallback-image.jpg';
            showMessage("Erreur lors du chargement de l'image", true);
        };
        
        openModal('enlargedPhotoModal');
    }
}

// Gestion de la sélection des photos
function togglePhotoSelection(checkbox, photoId) {
    if (checkbox.checked) {
        selectedPhotos.add(photoId);
    } else {
        selectedPhotos.delete(photoId);
    }
    updateClientChoiceButton();
}

function updateClientChoice(photoId, isChecked) {
    if (isChecked) {
        selectedPhotos.add(photoId);
    } else {
        selectedPhotos.delete(photoId);
    }
    calculatePaymentPlan();
}

function updateClientChoiceButton() {
    const button = document.getElementById('clientChoiceButton');
    if (!button) return;

    const count = selectedPhotos.size;
    button.textContent = `Choix client (${count})`;
    button.disabled = count === 0;
    button.classList.toggle('has-items', count > 0);
}
//Partie -4 ------------------------------------------------------------------------------------------------------
//Partie -5 Initialisation application et ecouteur d'evenements------------------------------------------------------------------------------------------------------
// Initialisation et écouteurs d'événements
document.addEventListener('DOMContentLoaded', function() {
    startApplication();
    initializeEventListeners();
    initializeStickyFamilleHeaders();
});


async function startApplication() {
    console.log("Initialisation de l'application...");
    
    try {
        // Vérification de l'authentification avant tout
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) return;

        // Initialisation des composants
        populateFamilleSelect();
        await fetchLatestBasePrice();
        await fetchPhotos();
        updateClientChoiceButton();
        updateUIBasedOnRole();

        // Gestion de la connexion Internet
        window.addEventListener('online', () => {
            showMessage('Connexion Internet rétablie');
            fetchPhotos();
        });

        window.addEventListener('offline', () => {
            showMessage('Connexion Internet perdue', true);
        });
    /*} catch (error) {
        console.error("Erreur lors de l'initialisation:", error);
        showMessage("Erreur lors du chargement de l'application", true);
    }
        */
    } catch (error) {
        console.error("Erreur lors de l'initialisation:", error);
        showMessage(error.message || "Erreur lors du chargement de l'application", true);
    } finally {
        toggleLoading(false);
    }

}


// Fonction pour peupler le filtre de famille
function populateFamilleSelect() {
    fetch(`${API_URL}/familles`)
        .then(response => response.json())
        .then(familles => {
            const familleSelects = document.querySelectorAll('#familleFilter, #newPhotoFamille, #editPhotoFamille');
            familleSelects.forEach(select => {
                select.innerHTML = '';
                familles.forEach(famille => {
                    const option = document.createElement('option');
                    option.value = famille;
                    option.textContent = famille;
                    select.appendChild(option);
                });
            });
        })
        .catch(error => {
            console.error('Erreur lors du chargement des familles:', error);
            showMessage('Erreur lors du chargement des familles', true);
        });
}

// Fonction pour calculer le plan de paiement
/*
function calculatePaymentPlan() {
    const amount = document.getElementById('paymentAmount')?.value || 0;
    const period = document.getElementById('paymentPeriod')?.value;
    const totalPrice = parseFloat(document.getElementById('totalPrice')?.textContent.replace(/[^\d]/g, '')) || 0;

    if (!amount || !totalPrice) {
        document.getElementById('paymentPlan').textContent = '';
        return;
    }

    let periodInMonths;
    switch (period) {
        case 'daily': periodInMonths = 1/30; break;
        case 'weekly': periodInMonths = 1/4; break;
        case 'monthly': periodInMonths = 1; break;
        case 'quarterly': periodInMonths = 3; break;
        case 'semiannual': periodInMonths = 6; break;
        case 'annual': periodInMonths = 12; break;
        default: periodInMonths = 1;
    }

    const monthsNeeded = Math.ceil(totalPrice / amount / periodInMonths);
    const timeEstimate = monthsNeeded > 1 ? `${monthsNeeded} mois` : '1 mois';
    document.getElementById('paymentPlan').textContent = timeEstimate;
}
*/

function calculatePaymentPlan() {
    const totalPrice = Array.from(selectedPhotos).reduce((sum, photoId) => {
        const photo = photos.find(p => p._id === photoId);
        return sum + Math.round(calculatePrice(photo.poids_bijou));
    }, 0);

    const paymentAmount = parseFloat(document.getElementById('paymentAmount').value) || 0;
    const paymentPeriod = document.getElementById('paymentPeriod').value;

    let periodInDays;
    switch (paymentPeriod) {
        case 'daily': periodInDays = 1; break;
        case 'weekly': periodInDays = 7; break;
        case 'monthly': periodInDays = 30; break;
        case 'quarterly': periodInDays = 90; break;
        case 'semiannual': periodInDays = 180; break;
        case 'annual': periodInDays = 365; break;
        default: periodInDays = 30;
    }

    const totalPeriods = paymentAmount > 0 ? Math.ceil(totalPrice / paymentAmount) : 0;
    const totalDays = totalPeriods * periodInDays;

    const years = Math.floor(totalDays / 365);
    const months = Math.floor((totalDays % 365) / 30);
    const days = totalDays % 30;

    let durationText = '';
    if (years > 0) durationText += `${years} an${years > 1 ? 's' : ''} `;
    if (months > 0) durationText += `${months} mois `;
    if (days > 0) durationText += `${days} jour${days > 1 ? 's' : ''}`;

    document.getElementById('totalPrice').textContent = formatNumber(totalPrice);
    document.getElementById('paymentPlan').textContent = durationText.trim() || 'Moins d\'un jour';

    // Mise à jour visuelle du total
    const totalElement = document.getElementById('totalPrice');
    totalElement.classList.add('highlight');
    setTimeout(() => totalElement.classList.remove('highlight'), 300);
}











function initializeEventListeners() {
    // Boutons de navigation avec vérification des permissions
    const updatePriceBtn = document.getElementById('updatePriceBtn');
    const addPhotoBtn = document.getElementById('addPhotoBtn');
    const clientChoiceBtn = document.getElementById('clientChoiceButton');

    if (updatePriceBtn) {
        updatePriceBtn.addEventListener('click', () => {
            if (!currentUser) {
                showMessage('Veuillez vous connecter pour continuer', true);
                return;
            }
            updateBasePrice();
        });
    }

    if (addPhotoBtn) {
        addPhotoBtn.addEventListener('click', () => {
            if (currentUser?.role === 'admin') {
                openModal('addPhotoModal');
            } else {
                showMessage('Accès réservé aux administrateurs', true);
            }
        });
    }

    if (clientChoiceBtn) {
        clientChoiceBtn.addEventListener('click', openClientChoiceModal);
    }

    // Formulaires
    const addPhotoForm = document.getElementById('addPhotoForm');
    if (addPhotoForm) {
        addPhotoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (currentUser?.role === 'admin') {
                addNewPhoto(e);
            } else {
                showMessage('Accès non autorisé', true);
            }
        });
    }

    const editPhotoForm = document.getElementById('editPhotoForm');
    if (editPhotoForm) {
        editPhotoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (currentUser?.role === 'admin') {
                updatePhoto(e);
            } else {
                showMessage('Accès non autorisé', true);
            }
        });
    }

    // Prévisualisation des images
    const newPhotoFile = document.getElementById('newPhotoFile');
    const editPhotoFile = document.getElementById('editPhotoFile');

    if (newPhotoFile) {
        newPhotoFile.addEventListener('change', function() {
            previewImage(this, 'newPhotoPreview');
        });
    }

    if (editPhotoFile) {
        editPhotoFile.addEventListener('change', function() {
            previewImage(this, 'editPhotoPreview');
        });
    }

    // Fermeture des modals
    document.querySelectorAll('.close').forEach(button => {
        button.addEventListener('click', (e) => {
            const modalId = e.target.closest('.modal').id;
            closeModal(modalId);
        });
    });

    // Plan de paiement
    ['paymentAmount', 'paymentPeriod'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', calculatePaymentPlan);
            element.addEventListener('keyup', calculatePaymentPlan);
        }
    });

    // Filtre par famille
    const familleFilter = document.getElementById('familleFilter');
    if (familleFilter) {
        familleFilter.addEventListener('change', filterByFamille);
    }

    // Gestion du scroll
    window.addEventListener('scroll', handleStickyNav);
    window.addEventListener('resize', handleStickyNav);

    // Fermeture des modals en cliquant en dehors
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            closeModal(event.target.id);
        }
    };
}

// Gestion des erreurs globales
window.onerror = function(message, source, lineno, colno, error) {
    console.error('Erreur globale:', { message, source, lineno, colno, error });
    showMessage('Une erreur inattendue est survenue', true);
    return false;
};

window.onunhandledrejection = function(event) {
    console.error('Promesse non gérée:', event.reason);
    showMessage('Une erreur inattendue est survenue', true);
};

// Gestion des familles
async function filterByFamille() {
    try {
        const familleSelect = document.getElementById('familleFilter');
        if (!familleSelect) return;

        currentFamilleFilter = familleSelect.value;
        await fetchPhotos();
    } catch (error) {
        console.error('Erreur lors du filtrage:', error);
        showMessage('Erreur lors du filtrage des photos', true);
    }
}

// Utilitaire pour les requêtes API
async function handleApiRequest(url, options = {}) {
    try {
        // Ajout automatique du token d'authentification
        const headers = {
            'Accept': 'application/json',
            'Authorization': `Bearer ${userToken}`,
            ...options.headers
        };

        if (options.method !== 'GET' && !options.body?.constructor?.name === 'FormData') {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, {
            ...options,
            headers
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/login.html';
                throw new Error('Session expirée');
            }
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Erreur API:', error);
        showMessage(error.message, true);
        throw error;
    }
}
//Partie -5 ------------------------------------------------------------------------------------------------------


// Génération du PDF
/*
window.generatePDF = function() {
    console.log("Génération du PDF...");
    
    if (typeof window.jspdf === 'undefined') {
        console.error("jsPDF n'est pas chargé");
        showMessage("Erreur : jsPDF n'est pas chargé correctement", true);
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const margin = 15;

        // Police et couleurs
        doc.setFont("helvetica");
        doc.setTextColor(0, 0, 0);

        // En-tête avec logo (position conservée pour le logo qui sera ajouté)
        
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.text('TontinOR', pageWidth / 2, 15, { align: 'center' });
        
        // Sous-titre
        doc.setFontSize(16);
        doc.setFont("helvetica", "normal");
        doc.text('Catalogue 2024-2025', pageWidth / 2, 25, { align: 'center' });

        // Informations de contact
        doc.setFontSize(10);
        doc.setTextColor(100);
        const contacts = 'Tél : 77667 80 80 - 77833 64 64 - 77833 67 67';
        doc.text(contacts, pageWidth / 2, 32, { align: 'center' });

        // Email de l'utilisateur
        doc.setFontSize(10);
        doc.setTextColor(80);
        const userEmail = currentUser?.email || 'Utilisateur non connecté';
        doc.text(`Contact : ${userEmail}`, margin, 40);

        // Date et référence
        const currentDate = new Date().toLocaleDateString('fr-FR');
        doc.text(`Date: ${currentDate}`, pageWidth - margin - 40, 40);

        // Titre du bon de commande
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.text('BON DE COMMANDE', pageWidth / 2, 50, { align: 'center' });

        // Ligne de séparation
        doc.setDrawColor(200);
        doc.line(margin, 55, pageWidth - margin, 55);

        // Liste des bijoux
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        let y = 65;
        
        // En-tête du tableau
        const headers = ['Désignation', 'Référence', 'Poids (g)', 'Prix (F CFA)'];
        const colWidth = (pageWidth - 2 * margin) / 4;
        
        // Style d'en-tête
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, y - 5, pageWidth - 2 * margin, 8, 'F');
        headers.forEach((header, i) => {
            doc.text(header, margin + (i * colWidth), y);
        });
        y += 8;

        // Données du tableau
        let totalPrice = 0;
        selectedPhotos.forEach((photoId) => {
            const photo = photos.find(p => p._id === photoId);
            if (photo) {
                const price = Math.round(calculatePrice(photo.poids_bijou));
                totalPrice += price;

                if (y > 250) { // Nouvelle page si nécessaire
                    doc.addPage();
                    y = 20;
                }

                doc.text(photo.nom_photo, margin, y);
                doc.text(photo.reference, margin + colWidth, y);
                doc.text(photo.poids_bijou.toFixed(2), margin + (2 * colWidth), y);
                doc.text(formatNumber(price), margin + (3 * colWidth), y);
                y += 7;
            }
        });

        // Total et modalités de paiement
        doc.setDrawColor(200);
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;

        doc.setFont("helvetica", "bold");
        doc.text(`Prix Total: ${formatNumber(totalPrice)} F CFA`, pageWidth - margin - 60, y);

        // Informations de paiement
        y += 15;
        const paymentAmount = document.getElementById('paymentAmount').value;
        const paymentPeriod = document.getElementById('paymentPeriod');
        const periodText = paymentPeriod.options[paymentPeriod.selectedIndex].text;
        const paymentPlan = document.getElementById('paymentPlan').textContent;

        if (paymentAmount) {
            doc.setFont("helvetica", "normal");
            doc.text(`Modalités de paiement:`, margin, y);
            y += 7;
            doc.text(`- Versement: ${formatNumber(paymentAmount)} F CFA ${periodText}`, margin + 5, y);
            y += 7;
            doc.text(`- Durée estimée: ${paymentPlan}`, margin + 5, y);
        }

        // Zone de signatures
        y = doc.internal.pageSize.height - 40;
        doc.setFont("helvetica", "normal");
        doc.text('Signature du client:', margin, y);
        doc.text('Signature et cachet:', pageWidth - margin - 50, y);

        // Pied de page
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text('TontinOR - Catalogue 2024-2025', pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });

        // Sauvegarde du PDF
        const fileName = `Bon_Commande_TontinOR_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
        showMessage("PDF généré avec succès");
    } catch (error) {
        console.error("Erreur lors de la génération du PDF:", error);
        showMessage("Erreur lors de la génération du PDF", true);
    }
};
*/
window.generatePDF = function() {
    console.log("Génération du PDF...");
    
    if (typeof window.jspdf === 'undefined') {
        console.error("jsPDF n'est pas chargé");
        showMessage("Erreur : jsPDF n'est pas chargé correctement", true);
        return;
    }

    // Fonction pour charger l'image
    function loadLogoImage() {
        return new Promise((resolve, reject) => {
            const logoElement = document.querySelector('.logo');
            if (!logoElement) {
                reject(new Error("Logo non trouvé dans le DOM"));
                return;
            }

            const img = new Image();
            img.crossOrigin = "Anonymous";

            img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };

            img.onerror = function() {
                // Essayer le fallback
                const fallbackSrc = logoElement.dataset.fallback;
                if (fallbackSrc && img.src !== fallbackSrc) {
                    img.src = fallbackSrc;
                } else {
                    reject(new Error("Impossible de charger le logo"));
                }
            };

            img.src = logoElement.src;
        });
    }

    // Fonction principale asynchrone
    async function generatePDFWithLogo() {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.width;
            const margin = 15;

            // Police et couleurs
            doc.setFont("helvetica");
            doc.setTextColor(0, 0, 0);

            try {
                // Chargement et ajout du logo
                const logoBase64 = await loadLogoImage();
                // Dimensions du logo
                const logoWidth = 30;  // largeur en mm
                const logoHeight = 20;  // hauteur en mm
                // Position du logo en haut à gauche
                doc.addImage(logoBase64, 'PNG', margin, 5, logoWidth, logoHeight);
            } catch (logoError) {
                console.warn("Logo non chargé:", logoError);
                // Continuer sans logo
            }

            // En-tête - ajusté pour laisser de l'espace au logo
            doc.setFontSize(20);
            doc.setFont("helvetica", "bold");
            doc.text('TontinOR', pageWidth / 2, 15, { align: 'center' });
            
            // Sous-titre
            doc.setFontSize(16);
            doc.setFont("helvetica", "normal");
            doc.text('Catalogue 2024-2025', pageWidth / 2, 25, { align: 'center' });

            // Informations de contact - alignées avec le reste
            doc.setFontSize(10);
            doc.setTextColor(100);
            const contacts = 'Tél : 77667 80 80 - 77833 64 64 - 77833 67 67';
            doc.text(contacts, pageWidth / 2, 32, { align: 'center' });

            // Email et date sur la même ligne
            doc.setFontSize(10);
            doc.setTextColor(80);
            const userEmail = currentUser?.email || 'Utilisateur non connecté';
            doc.text(`Contact : ${userEmail}`, margin, 40);
            const currentDate = new Date().toLocaleDateString('fr-FR');
            doc.text(`Date: ${currentDate}`, pageWidth - margin - 40, 40);

            // Titre du bon de commande
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.setFont("helvetica", "bold");
            doc.text('BON DE COMMANDE', pageWidth / 2, 50, { align: 'center' });

            // Ligne de séparation
            doc.setDrawColor(200);
            doc.line(margin, 55, pageWidth - margin, 55);

            // Liste des bijoux
            doc.setFontSize(11);
            doc.setFont("helvetica", "normal");
            let y = 65;
            
            // En-tête du tableau avec style amélioré
            const headers = ['Désignation', 'Référence', 'Poids (g)', 'Prix (F CFA)'];
            const colWidth = (pageWidth - 2 * margin) / 4;
            
            // Style d'en-tête amélioré
            doc.setFillColor(230, 230, 230);
            doc.rect(margin, y - 5, pageWidth - 2 * margin, 8, 'F');
            doc.setFont("helvetica", "bold");
            headers.forEach((header, i) => {
                doc.text(header, margin + (i * colWidth), y);
            });
            y += 8;

            // Données du tableau avec alternance de couleurs
            let totalPrice = 0;
            selectedPhotos.forEach((photoId, index) => {
                const photo = photos.find(p => p._id === photoId);
                if (photo) {
                    const price = Math.round(calculatePrice(photo.poids_bijou));
                    totalPrice += price;

                    if (y > 250) {
                        doc.addPage();
                        y = 20;
                    }

                    // Alternance de couleurs pour les lignes
                    if (index % 2 === 0) {
                        doc.setFillColor(245, 245, 245);
                        doc.rect(margin, y - 4, pageWidth - 2 * margin, 7, 'F');
                    }

                    doc.setFont("helvetica", "normal");
                    doc.text(photo.nom_photo, margin, y);
                    doc.text(photo.reference, margin + colWidth, y);
                    doc.text(photo.poids_bijou.toFixed(2), margin + (2 * colWidth), y);
                    doc.text(formatNumber(price), margin + (3 * colWidth), y);
                    y += 7;
                }
            });

            // Total avec mise en forme améliorée
            y += 3;
            doc.setDrawColor(100);
            doc.setLineWidth(0.5);
            doc.line(margin, y, pageWidth - margin, y);
            y += 10;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text(`Prix Total: ${formatNumber(totalPrice)} F CFA`, pageWidth - margin - 60, y);

            // Informations de paiement dans un cadre
            const paymentAmount = document.getElementById('paymentAmount').value;
            if (paymentAmount) {
                y += 15;
                const paymentPeriod = document.getElementById('paymentPeriod');
                const periodText = paymentPeriod.options[paymentPeriod.selectedIndex].text;
                const paymentPlan = document.getElementById('paymentPlan').textContent;

                // Cadre pour les modalités de paiement
                doc.setDrawColor(200);
                doc.setFillColor(250, 250, 250);
                doc.roundedRect(margin, y - 5, pageWidth - 2 * margin, 30, 3, 3, 'FD');

                doc.setFont("helvetica", "bold");
                doc.text('Modalités de paiement:', margin + 5, y);
                y += 7;
                doc.setFont("helvetica", "normal");
                doc.text(`- Versement: ${formatNumber(paymentAmount)} F CFA ${periodText}`, margin + 10, y);
                y += 7;
                doc.text(`- Durée estimée: ${paymentPlan}`, margin + 10, y);
            }

            // Zone de signatures avec cadres
            y = doc.internal.pageSize.height - 40;
            doc.setFont("helvetica", "normal");
            doc.text('Signature du client:', margin, y);
            doc.rect(margin, y + 5, 60, 20);

            doc.text('Signature et cachet:', pageWidth - margin - 70, y);
            doc.rect(pageWidth - margin - 70, y + 5, 60, 20);

            // Pied de page amélioré
            doc.setFontSize(8);
            doc.setTextColor(100);
            const pageText = 'TontinOR - Catalogue 2024-2025';
            doc.text(pageText, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });

            // Sauvegarde du PDF
            const fileName = `Bon_Commande_TontinOR_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);
            showMessage("PDF généré avec succès");

        } catch (error) {
            console.error("Erreur lors de la génération du PDF:", error);
            showMessage("Erreur lors de la génération du PDF", true);
        }
    }

    // Lancement de la génération
    generatePDFWithLogo();
};