// Main App Logic for Kinetic Oracle
window.API_BASE = window.API_BASE || 'http://localhost:8000';
var API_BASE = window.API_BASE;

async function fetchUserProfile() {
    try {
        const response = await fetch(`${API_BASE}/user`);
        if (response.ok) {
            const user = await response.json();
            updateUIAvatar(user.avatar_url);
            updateUIProfileData(user);
        }
    } catch (e) {
        console.error("Failed to fetch user profile from backend:", e);
    }
}

function updateUIAvatar(url) {
    const avatars = document.querySelectorAll('.top-app-bar__avatar img, .top-app-bar__avatar, .rounded-xl img');
    avatars.forEach(img => {
        if (img.tagName === 'IMG') {
            img.src = url;
        }
    });
}

function updateUIProfileData(user) {
    // Specifically for profile page
    const nameEl = document.querySelector('h2.text-display-md');
    const levelEl = document.querySelector('p.text-label-sm');
    
    if (nameEl && nameEl.innerText.toUpperCase().includes('ALEX')) {
        nameEl.innerText = user.name.toUpperCase();
    }
    if (levelEl && levelEl.innerText.toUpperCase().includes('LEVEL')) {
        levelEl.innerText = `${user.status.toUpperCase()} | LEVEL ${user.level}`;
    }
}

function initApp() {
    console.log('Kinetic Oracle Initialized');
    
    fetchUserProfile();

    // Bottom navigation highlight logic
    const path = window.location.pathname;
    const navItems = document.querySelectorAll('.bottom-nav__item');
    
    navItems.forEach(item => {
        item.classList.remove('bottom-nav__item--active');
        const icon = item.querySelector('.material-symbols-outlined');
        if (icon) icon.classList.remove('filled');
        
        const href = item.getAttribute('href');
        const isWorkout = href === 'workout.html' && (path.includes('workout.html') || path.includes('session-summary.html'));
        const isShop = (href === 'shop.html' || href === 'shop_page') && (path.includes('shop.html') || path.includes('shop_page'));
        
        if ((path.includes(href) && href !== '#' && href !== '') || isWorkout || isShop) {
            item.classList.add('bottom-nav__item--active');
            if (icon) icon.classList.add('filled');
        }
    });

    // Special logic for Homepage
    if (path.includes('dashboard.html') || path.endsWith('/') || path.includes('index.html')) {
        // Hydrate last workout summary from localStorage
        try {
            const stored = localStorage.getItem('kinetic_last_workout_session');
            if (stored) {
                const session = JSON.parse(stored);
                
                const timeEl = document.getElementById('dash-summary-time');
                const durEl = document.getElementById('dash-summary-dur');
                const calEl = document.getElementById('dash-summary-cal');
                const hrEl = document.getElementById('dash-summary-hr');
                const precEl = document.getElementById('dash-summary-prec');

                if (timeEl && session.timestamp) {
                    const dt = new Date(session.timestamp);
                    timeEl.textContent = `Today, ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                }
                if (durEl) {
                    const mins = session.durationFormatted || `${session.durationMinutes || 15}m`;
                    durEl.innerHTML = `${mins}<span class="stat-item__unit"></span>`;
                }
                if (calEl) {
                    calEl.innerHTML = `${session.caloriesBurned || 98}<span class="stat-item__unit">kcal</span>`;
                }
                if (hrEl) {
                    const estHr = Math.round(130 + (session.totalReps || 15) * 0.7);
                    hrEl.innerHTML = `${estHr}<span class="stat-item__unit">bpm</span>`;
                }
                if (precEl) {
                    precEl.innerHTML = `${session.accuracyPct || 92}<span class="stat-item__unit">%</span>`;
                }
            }
        } catch(e) {
            console.warn('Dashboard workout summary parse error:', e);
        }

        // Animation for progress bars
        setTimeout(() => {
            const bars = document.querySelectorAll('.perf-bar');
            bars.forEach(bar => {
                const height = bar.style.height;
                bar.style.height = '0';
                setTimeout(() => {
                    bar.style.height = height;
                }, 100);
            });
        }, 500);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
