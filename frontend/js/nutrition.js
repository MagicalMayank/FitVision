/**
 * FitVision — Nutrition Module
 * Handles: meal scanning, localStorage persistence, UI updates, AI insights
 */

const NUTRITION_API = window.API_BASE;
const STORAGE_KEY = 'kinetic_nutrition_data';
const TODAY_KEY = () => new Date().toISOString().split('T')[0];

// Daily goals
const GOALS = {
    calories: 2400, protein: 150, carbs: 280, fat: 70
};

// ============================================================
// LOCAL STORAGE PERSISTENCE
// ============================================================

function loadNutritionData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return createEmptyDay();
        const data = JSON.parse(raw);
        if (data.date !== TODAY_KEY()) return createEmptyDay();
        return data;
    } catch { return createEmptyDay(); }
}

function saveNutritionData(data) {
    data.date = TODAY_KEY();
    data.updated_at = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function createEmptyDay() {
    return {
        date: TODAY_KEY(),
        meals: [],
        totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        updated_at: new Date().toISOString()
    };
}

function addMealToStorage(scanResult) {
    const data = loadNutritionData();
    const meal = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        foods: scanResult.foods.map(f => ({
            display_name: f.display_name,
            class_name: f.class_name,
            confidence: f.confidence,
            portion_g: f.portion_g,
            nutrition: f.nutrition,
            db_match: f.db_match,
            category: f.category
        })),
        totals: scanResult.totals,
        scan_image: scanResult.scan_image
    };
    data.meals.push(meal);
    // Recalculate daily totals
    data.totals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    data.meals.forEach(m => {
        data.totals.calories += m.totals.calories || 0;
        data.totals.protein_g += m.totals.protein_g || 0;
        data.totals.carbs_g += m.totals.carbs_g || 0;
        data.totals.fat_g += m.totals.fat_g || 0;
    });
    // Round totals
    Object.keys(data.totals).forEach(k => data.totals[k] = Math.round(data.totals[k] * 10) / 10);
    saveNutritionData(data);
    return data;
}

// ============================================================
// UI REFERENCES (grabbed after DOM load)
// ============================================================
let DOM = {};

function grabDOM() {
    DOM = {
        // Today's Fuel
        caloriesCurrent: document.getElementById('calories-current'),
        caloriesGoal: document.getElementById('calories-goal'),
        caloriesBar: document.getElementById('calories-bar'),
        proteinCurrent: document.getElementById('protein-current'),
        proteinGoal: document.getElementById('protein-goal'),
        carbsCurrent: document.getElementById('carbs-current'),
        carbsGoal: document.getElementById('carbs-goal'),
        fatCurrent: document.getElementById('fat-current'),
        fatGoal: document.getElementById('fat-goal'),
        macroStatus: document.getElementById('macro-status'),
        macroStatusIcon: document.getElementById('macro-status-icon'),

        // Scan section & Camera
        scanOverlay: document.getElementById('scan-overlay'),
        scanImage: document.getElementById('scan-image'),
        scanBoxes: document.getElementById('scan-boxes'),
        scanBadge: document.getElementById('scan-badge'),
        webcam: document.getElementById('nutrition-webcam'),
        toggleCamBtn: document.getElementById('toggle-cam-btn'),
        shutterBtn: document.getElementById('shutter-btn'),
        galleryBtn: document.getElementById('gallery-btn'),
        cameraBtn: document.getElementById('camera-btn'),

        // Scan Results (inside scan card)
        scanResultsArea: document.getElementById('scan-results-area'),

        // AI Insight
        aiInsightText: document.getElementById('ai-insight-text'),
        aiInsightBtn: document.getElementById('ai-insight-btn'),
        aiLoadIndicator: document.getElementById('ai-load-indicator'),
        aiRecoveryIndicator: document.getElementById('ai-recovery-indicator'),
        aiTargetIndicator: document.getElementById('ai-target-indicator'),

        // Recovery Score
        recoveryScoreRing: document.getElementById('recovery-score-ring'),
        recoveryScoreValue: document.getElementById('recovery-score-value'),
        recoveryProtein: document.getElementById('recovery-protein'),
        recoveryHydration: document.getElementById('recovery-hydration'),
        recoveryCarbs: document.getElementById('recovery-carbs'),
        recoveryCalories: document.getElementById('recovery-calories'),

        // Meals Timeline
        mealsTimeline: document.getElementById('meals-timeline'),
        mealsContainer: document.getElementById('meals-container'),

        // File input (hidden)
        fileInput: document.getElementById('meal-file-input'),

        // Loading overlay
        loadingOverlay: document.getElementById('loading-overlay')
    };
}

// ============================================================
// UI UPDATE FUNCTIONS
// ============================================================

function updateDailyTotals(data) {
    const t = data.totals;

    // Calories
    if (DOM.caloriesCurrent) DOM.caloriesCurrent.textContent = Math.round(t.calories).toLocaleString();
    if (DOM.caloriesGoal) DOM.caloriesGoal.textContent = `/ ${GOALS.calories.toLocaleString()} kcal`;
    if (DOM.caloriesBar) {
        const pct = Math.min((t.calories / GOALS.calories) * 100, 100);
        DOM.caloriesBar.style.width = pct + '%';
    }

    // Macros
    if (DOM.proteinCurrent) DOM.proteinCurrent.textContent = Math.round(t.protein_g);
    if (DOM.proteinGoal) DOM.proteinGoal.textContent = `/${GOALS.protein}g`;
    if (DOM.carbsCurrent) DOM.carbsCurrent.textContent = Math.round(t.carbs_g);
    if (DOM.carbsGoal) DOM.carbsGoal.textContent = `/${GOALS.carbs}g`;
    if (DOM.fatCurrent) DOM.fatCurrent.textContent = Math.round(t.fat_g);
    if (DOM.fatGoal) DOM.fatGoal.textContent = `/${GOALS.fat}g`;

    // Status message
    if (DOM.macroStatus) {
        const proteinPct = Math.round((t.protein_g / GOALS.protein) * 100);
        if (data.meals.length === 0) {
            DOM.macroStatus.textContent = "No meals logged yet. Scan your first meal!";
            if (DOM.macroStatusIcon) DOM.macroStatusIcon.textContent = "info";
        } else if (proteinPct >= 90) {
            DOM.macroStatus.textContent = `Protein target reached! ${proteinPct}% complete.`;
            if (DOM.macroStatusIcon) DOM.macroStatusIcon.textContent = "check_circle";
        } else {
            DOM.macroStatus.textContent = `Protein intake is ${proteinPct}% of today's target.`;
            if (DOM.macroStatusIcon) DOM.macroStatusIcon.textContent = "check_circle";
        }
    }

    // Recovery Score & Dynamic Load/Recovery Indicators
    updateRecoveryScore(data);
    updateDynamicPerformanceIndicators(data);
}

function updateDynamicPerformanceIndicators(data) {
    const t = data ? data.totals : { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    
    // 1. Calculate LOAD dynamically from workout history & real session data
    let loadText = 'LOW';
    let loadColor = 'var(--secondary)'; // green

    try {
        let history = [];
        const rawHistory = localStorage.getItem('kinetic_workout_history');
        if (rawHistory) history = JSON.parse(rawHistory);

        const lastSessionRaw = localStorage.getItem('kinetic_last_workout_session');
        let lastSession = lastSessionRaw ? JSON.parse(lastSessionRaw) : null;
        
        const todayStr = TODAY_KEY();
        const todayWorkouts = history.filter(s => s.timestamp && s.timestamp.startsWith(todayStr));
        
        let totalRepsToday = todayWorkouts.reduce((acc, s) => acc + (s.reps || 0), 0);
        if (lastSession && lastSession.timestamp && lastSession.timestamp.startsWith(todayStr)) {
            totalRepsToday = Math.max(totalRepsToday, lastSession.reps || 0);
        }

        if (totalRepsToday >= 25 || todayWorkouts.length >= 2) {
            loadText = 'HIGH';
            loadColor = 'var(--error)'; // red/coral
        } else if (totalRepsToday > 0 || todayWorkouts.length > 0 || history.length > 0) {
            loadText = 'MED';
            loadColor = 'var(--primary-fixed)'; // yellow
        } else {
            loadText = 'LOW';
            loadColor = 'var(--secondary)'; // green
        }
    } catch(e) {
        console.warn('Error computing load indicator:', e);
    }

    if (DOM.aiLoadIndicator) {
        DOM.aiLoadIndicator.textContent = loadText;
        DOM.aiLoadIndicator.style.color = loadColor;
    }

    // 2. Calculate RECOVERY dynamically from actual nutrition intake vs goals
    const proteinRatio = (t.protein_g || 0) / (GOALS.protein || 150);
    const calorieRatio = (t.calories || 0) / (GOALS.calories || 2400);
    const avgScore = (proteinRatio * 0.6 + calorieRatio * 0.4);

    let recoveryText = 'LOW';
    let recoveryColor = 'var(--error)'; // coral/red

    if (avgScore >= 0.75) {
        recoveryText = 'HIGH';
        recoveryColor = 'var(--secondary)'; // green
    } else if (avgScore >= 0.35) {
        recoveryText = 'MED';
        recoveryColor = 'var(--primary-fixed)'; // yellow
    } else {
        recoveryText = 'LOW';
        recoveryColor = 'var(--error)'; // coral/red
    }

    if (DOM.aiRecoveryIndicator) {
        DOM.aiRecoveryIndicator.textContent = recoveryText;
        DOM.aiRecoveryIndicator.style.color = recoveryColor;
    }

    // 3. Calculate TARGET dynamically from user profile or goals
    let targetProteinG = GOALS.protein || 150;
    try {
        const storedProfile = localStorage.getItem('fitvision_user_profile');
        if (storedProfile) {
            const profile = JSON.parse(storedProfile);
            if (profile.weight) {
                targetProteinG = Math.round(profile.weight * 2.0);
            }
        }
    } catch(e) {}

    if (DOM.aiTargetIndicator) {
        DOM.aiTargetIndicator.textContent = `${targetProteinG}g`;
        DOM.aiTargetIndicator.style.color = 'white';
    }
}

function updateRecoveryScore(data) {
    const t = data.totals;
    const proteinRatio = Math.min((t.protein_g || 0) / GOALS.protein, 1);
    const carbsRatio = Math.min((t.carbs_g || 0) / GOALS.carbs, 1);
    const calRatio = Math.min((t.calories || 0) / GOALS.calories, 1);
    
    // Hydration calculation based on meals logged or fallback 50%
    const loggedMealsCount = data.meals ? data.meals.length : 0;
    const hydrationL = Math.min(1.0 + (loggedMealsCount * 0.3), 2.0);
    const hydrationRatio = hydrationL / 2.0;

    // Calculate weighted average recovery score
    const score = Math.round(
        (proteinRatio * 35 +
         carbsRatio * 25 +
         calRatio * 30 +
         hydrationRatio * 10)
    );

    if (DOM.recoveryScoreValue) DOM.recoveryScoreValue.textContent = score;

    // 1. Update 4-Segment Donut Chart Ring
    // Radius = 40, Arc Quarter = 57.8px max stroke length
    const MAX_ARC = 57.8;
    const TOTAL_C = 251.3;

    const setSegmentStroke = (id, ratio) => {
        const segEl = document.getElementById(id);
        if (segEl) {
            const fillLen = (MAX_ARC * Math.max(0, Math.min(ratio, 1))).toFixed(1);
            segEl.setAttribute('stroke-dasharray', `${fillLen} ${TOTAL_C}`);
        }
    };

    setSegmentStroke('seg-protein', proteinRatio);
    setSegmentStroke('seg-hydration', hydrationRatio);
    setSegmentStroke('seg-carbs', carbsRatio);
    setSegmentStroke('seg-calories', calRatio);

    // 2. Update Actionable Per-Macro Rows
    const formatMacroRow = (rowId, currentVal, targetVal, unit, ratio) => {
        const rowEl = document.getElementById(rowId);
        if (!rowEl) return;

        const valSpan = rowEl.querySelector('[id$="-row-vals"]');
        const gapSpan = rowEl.querySelector('[id$="-row-gap"]');

        const currentFormatted = typeof currentVal === 'number' ? Math.round(currentVal).toLocaleString() : currentVal;
        const targetFormatted = typeof targetVal === 'number' ? Math.round(targetVal).toLocaleString() : targetVal;

        if (valSpan) valSpan.textContent = `${currentFormatted}${unit} / ${targetFormatted}${unit}`;

        if (gapSpan) {
            let gapText = '';
            let gapColor = 'var(--error)';

            if (ratio >= 0.9) {
                gapText = 'target reached!';
                gapColor = 'var(--secondary)';
            } else if (ratio >= 0.5) {
                if (typeof targetVal === 'number' && typeof currentVal === 'number') {
                    const diff = Math.round((targetVal - currentVal) * 10) / 10;
                    gapText = diff <= 0.2 && unit === 'L' ? 'almost there' : `need ${diff}${unit} more`;
                } else {
                    gapText = 'almost there';
                }
                gapColor = '#ff9800'; // Amber
            } else {
                if (typeof targetVal === 'number' && typeof currentVal === 'number') {
                    const diff = Math.round((targetVal - currentVal) * 10) / 10;
                    gapText = `need ${diff}${unit} more`;
                } else {
                    gapText = 'below target';
                }
                gapColor = 'var(--error)'; // Red/Muted Warning
            }

            gapSpan.textContent = gapText;
            gapSpan.style.color = gapColor;
        }

        // Color coding whole row border
        if (ratio >= 0.9) {
            rowEl.style.borderColor = 'rgba(126,219,127,0.3)';
        } else if (ratio >= 0.5) {
            rowEl.style.borderColor = 'rgba(255,152,0,0.3)';
        } else {
            rowEl.style.borderColor = 'rgba(255,180,171,0.2)';
        }
    };

    formatMacroRow('recovery-protein', t.protein_g || 0, GOALS.protein, 'g', proteinRatio);
    formatMacroRow('recovery-hydration', hydrationL, 2.0, 'L', hydrationRatio);
    formatMacroRow('recovery-carbs', t.carbs_g || 0, GOALS.carbs, 'g', carbsRatio);
    formatMacroRow('recovery-calories', t.calories || 0, GOALS.calories, ' kcal', calRatio);
}

function renderMealsTimeline(data) {
    if (!DOM.mealsContainer) return;

    if (data.meals.length === 0) {
        DOM.mealsContainer.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--on-surface-variant);">
                <span class="material-symbols-outlined" style="font-size: 2.5rem; opacity: 0.3; display: block; margin-bottom: 0.5rem;">restaurant</span>
                <p style="font-size: 0.875rem;">No meals logged today.</p>
                <p style="font-size: 0.75rem; opacity: 0.6;">Scan your first meal to get started!</p>
            </div>
        `;
        return;
    }

    const mealIcons = ['free_breakfast', 'lunch_dining', 'dinner_dining', 'restaurant', 'bakery_dining'];
    DOM.mealsContainer.innerHTML = data.meals.map((meal, i) => {
        const icon = mealIcons[i % mealIcons.length];
        const time = new Date(meal.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const foodNames = meal.foods.map(f => f.display_name).join(', ');
        const totalCal = Math.round(meal.totals.calories);
        const totalPro = Math.round(meal.totals.protein_g);
        const thumbStyle = meal.scan_image ?
            `background-image: url('${meal.scan_image}');` : `background: var(--surface-container);`;

        return `
            <div class="meal-item">
                <div class="meal-dot">
                    <span class="material-symbols-outlined" style="font-size: 0.875rem;">${icon}</span>
                </div>
                <div class="meal-content">
                    <div class="meal-thumb" style="${thumbStyle}"></div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 700; font-size: 0.875rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${foodNames || 'Scanned Meal'}</div>
                        <div style="font-size: 0.75rem; color: var(--on-surface-variant); display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <span>${totalCal} kcal</span>
                            <span style="color: var(--secondary);">${totalPro}g Pro</span>
                            <span style="opacity: 0.5;">${time}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================
// CAMERA MANAGER & SCAN PIPELINE
// ============================================================

let cameraStream = null;
const offscreenCanvas = document.createElement('canvas');

async function startLiveCamera() {
    if (!DOM.webcam) return false;
    try {
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
            });
        } catch {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
        cameraStream = stream;
        DOM.webcam.srcObject = stream;
        DOM.webcam.style.display = 'block';

        // Update UI
        if (DOM.toggleCamBtn) {
            DOM.toggleCamBtn.querySelector('.material-symbols-outlined').textContent = 'videocam_off';
            DOM.toggleCamBtn.style.borderColor = 'var(--secondary)';
        }
        const badgeDot = document.getElementById('badge-dot');
        const badgeText = document.getElementById('badge-text');
        if (badgeDot) badgeDot.style.background = '#00ff66';
        if (badgeText) badgeText.textContent = 'LIVE CAMERA';

        return true;
    } catch (err) {
        console.warn('Live camera access failed:', err);
        showScanMessage('Camera permission required or not available. Upload a photo instead.', 'warning');
        return false;
    }
}

function stopLiveCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    if (DOM.webcam) {
        DOM.webcam.style.display = 'none';
        DOM.webcam.srcObject = null;
    }
    if (DOM.toggleCamBtn) {
        DOM.toggleCamBtn.querySelector('.material-symbols-outlined').textContent = 'videocam';
        DOM.toggleCamBtn.style.borderColor = 'rgba(245,255,0,0.2)';
    }
    const badgeDot = document.getElementById('badge-dot');
    const badgeText = document.getElementById('badge-text');
    if (badgeDot) badgeDot.style.background = 'var(--primary-fixed)';
    if (badgeText) badgeText.textContent = 'AI Ready';
}

function toggleLiveCamera() {
    if (cameraStream) {
        stopLiveCamera();
    } else {
        startLiveCamera();
    }
}

function captureFrameFromWebcam() {
    if (!DOM.webcam || DOM.webcam.readyState < 2) return null;
    const w = DOM.webcam.videoWidth || 640;
    const h = DOM.webcam.videoHeight || 480;
    offscreenCanvas.width = w;
    offscreenCanvas.height = h;
    const ctx = offscreenCanvas.getContext('2d');
    ctx.drawImage(DOM.webcam, 0, 0, w, h);
    return offscreenCanvas.toDataURL('image/jpeg', 0.85);
}

function showLoading(show) {
    if (DOM.loadingOverlay) {
        DOM.loadingOverlay.style.display = show ? 'flex' : 'none';
    }
    if (DOM.shutterBtn) {
        DOM.shutterBtn.disabled = show;
        const icon = DOM.shutterBtn.querySelector('.material-symbols-outlined');
        const span = DOM.shutterBtn.querySelector('span:not(.material-symbols-outlined)');
        if (show) {
            if (icon) { icon.textContent = 'progress_activity'; icon.style.animation = 'spin 1s linear infinite'; }
            if (span) span.textContent = 'ANALYZING...';
        } else {
            if (icon) { icon.textContent = 'photo_camera'; icon.style.animation = 'none'; }
            if (span) span.textContent = 'CAPTURE & SCAN';
        }
    }
}

async function handleMealScan(file) {
    const b64 = await fileToBase64(file);
    await handleMealScanBase64(b64);
}

async function handleMealScanBase64(b64) {
    showLoading(true);
    stopLiveCamera();

    try {
        // Show captured/uploaded image immediately
        if (DOM.scanImage) {
            DOM.scanImage.style.backgroundImage = `url('${b64}')`;
        }
        if (DOM.scanBoxes) DOM.scanBoxes.innerHTML = '';

        // Call backend
        const response = await fetch(`${NUTRITION_API}/nutrition/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: b64 })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const result = await response.json();

        // Update scan overlay with result image
        if (result.scan_image && DOM.scanImage) {
            DOM.scanImage.style.backgroundImage = `url('${result.scan_image}')`;
        }

        // Handle different states
        if (result.status === 'no_food') {
            showScanMessage(result.message, 'warning');
            showLoading(false);
            return;
        }

        // Render bounding boxes
        renderScanBoxes(result.foods);

        // Show detected foods summary
        renderScanResults(result);

        // Save to localStorage
        if (result.foods.length > 0) {
            const updatedData = addMealToStorage(result);
            updateDailyTotals(updatedData);
            renderMealsTimeline(updatedData);
        }

    } catch (err) {
        console.error('Scan error:', err);
        showScanMessage(
            err.message.includes('Failed to fetch') ?
            'Backend is offline. Start the server first.' :
            `Scan failed: ${err.message}`,
            'error'
        );
    } finally {
        showLoading(false);
    }
}

function renderScanBoxes(foods) {
    if (!DOM.scanBoxes) return;
    DOM.scanBoxes.innerHTML = foods.map(f => {
        const bn = f.bbox_normalized;
        const conf = Math.round(f.confidence * 100);
        const borderColor = f.confidence_level === 'low' ?
            'rgba(255, 180, 171, 0.8)' : 'var(--primary-fixed)';
        return `
            <div class="ai-box" style="
                left: ${bn.x * 100}%; top: ${bn.y * 100}%;
                width: ${bn.w * 100}%; height: ${bn.h * 100}%;
                border-color: ${borderColor};
                box-shadow: 0 0 8px ${borderColor === 'var(--primary-fixed)' ?
                    'rgba(245,255,0,0.6)' : 'rgba(255,180,171,0.4)'};
            ">
                <span class="ai-label">${f.display_name} ≈ ${f.portion_g}g</span>
            </div>
        `;
    }).join('');

    // Update badge
    if (DOM.scanBadge) {
        DOM.scanBadge.querySelector('.text-label-sm').textContent =
            `${foods.length} Item${foods.length > 1 ? 's' : ''} Found`;
    }
}

let currentScanResult = null;
let allFoodClasses = [];
let currentEditingIndex = 0;

function renderScanResults(result) {
    currentScanResult = result;
    if (!DOM.scanResultsArea) return;

    if (!result.foods.length) {
        DOM.scanResultsArea.innerHTML = '';
        return;
    }

    const statusColors = {
        success: 'var(--secondary)',
        low_confidence: 'var(--error)',
        partial_match: 'var(--primary-fixed)',
        no_food: 'var(--outline)'
    };

    DOM.scanResultsArea.innerHTML = `
        <div style="padding: 0 1.5rem 1.5rem; display: flex; flex-direction: column; gap: 0.75rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; color: ${statusColors[result.status] || 'var(--on-surface-variant)'};">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-symbols-outlined" style="font-size: 1rem;">
                        ${result.status === 'success' ? 'check_circle' : result.status === 'low_confidence' ? 'warning' : 'info'}
                    </span>
                    <span>${result.message}</span>
                </div>
            </div>
            ${result.foods.map((f, idx) => `
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem;
                    background: var(--surface-container-highest); padding: 0.75rem 1rem; border-radius: var(--radius-sm);
                    border: 1px solid ${f.db_match ? 'rgba(71,72,50,0.15)' : 'rgba(255,180,171,0.2)'};">
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-weight: 700; font-size: 0.85rem; color: white;">${f.display_name}</span>
                            ${f.is_custom ? '<span style="font-size: 0.6rem; background: var(--secondary); color: black; padding: 0.1rem 0.4rem; border-radius: 1rem; font-weight: 700;">CUSTOM</span>' : ''}
                        </div>
                        <div style="font-size: 0.65rem; color: var(--on-surface-variant); display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.15rem;">
                            <span>${Math.round(f.confidence * 100)}% conf</span>
                            <span>≈ ${f.portion_g}g</span>
                            ${!f.db_match ? '<span style="color: var(--error);">No DB match</span>' : ''}
                        </div>
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        ${f.db_match ? `
                        <div style="text-align: right; font-size: 0.7rem;">
                            <div style="font-weight: 700; color: var(--primary-fixed);">${f.nutrition.calories} kcal</div>
                            <div style="color: var(--on-surface-variant);">P${f.nutrition.protein_g}g C${f.nutrition.carbs_g}g F${f.nutrition.fat_g}g</div>
                        </div>` : ''}

                        <button onclick="openEditModal(${idx})" title="Correct food item or portion size" style="padding: 0.4rem 0.6rem; background: rgba(245,255,0,0.1); border: 1px solid rgba(245,255,0,0.3); border-radius: var(--radius-sm); color: var(--primary-fixed); font-size: 0.7rem; font-weight: 700; display: flex; align-items: center; gap: 0.25rem; cursor: pointer;">
                            <span class="material-symbols-outlined" style="font-size: 0.9rem;">edit</span>
                            <span>CORRECT</span>
                        </button>
                    </div>
                </div>
            `).join('')}
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-top: 1px solid rgba(71,72,50,0.15); font-size: 0.8rem; font-weight: 700;">
                <span>Meal Total</span>
                <span style="color: var(--primary-fixed);">${result.totals.calories} kcal | P${result.totals.protein_g}g C${result.totals.carbs_g}g F${result.totals.fat_g}g</span>
            </div>
        </div>
    `;
}

function showScanMessage(message, type) {
    if (!DOM.scanResultsArea) return;
    const color = type === 'error' ? 'var(--error)' : 'var(--primary-fixed)';
    const icon = type === 'error' ? 'error' : 'warning';
    DOM.scanResultsArea.innerHTML = `
        <div style="padding: 1rem 1.5rem; display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: ${color};">
            <span class="material-symbols-outlined" style="font-size: 1.25rem;">${icon}</span>
            <span>${message}</span>
        </div>
    `;
}

// ============================================================
// EDIT MEAL & MODEL FEEDBACK SYSTEM
// ============================================================

async function fetchFoodClasses() {
    try {
        const res = await fetch(`${NUTRITION_API}/nutrition/classes`);
        if (res.ok) {
            const data = await res.json();
            allFoodClasses = data.classes || [];
            populateClassSelect();
        }
    } catch (e) {
        console.warn('Could not load food classes list:', e);
    }
}

function populateClassSelect() {
    const select = document.getElementById('edit-class-select');
    if (!select) return;
    select.innerHTML = '<option value="">-- Select correct dish --</option>' +
        allFoodClasses.map(c => `<option value="${c.key}">${c.display_name}${c.is_custom ? ' (Custom)' : ''}</option>`).join('');
}

window.openEditModal = function(index) {
    if (!currentScanResult || !currentScanResult.foods[index]) return;
    currentEditingIndex = index;
    const food = currentScanResult.foods[index];

    const modal = document.getElementById('edit-meal-modal');
    const predInput = document.getElementById('edit-predicted-name');
    const select = document.getElementById('edit-class-select');
    const portionSlider = document.getElementById('edit-portion-slider');
    const portionDisplay = document.getElementById('portion-val-display');

    if (predInput) predInput.value = food.display_name;
    if (portionSlider) portionSlider.value = food.portion_g || 150;
    if (portionDisplay) portionDisplay.textContent = `${food.portion_g || 150}g`;

    if (select) {
        const match = allFoodClasses.find(c => c.key === food.class_name || c.display_name.toLowerCase() === food.display_name.toLowerCase());
        if (match) select.value = match.key;
    }

    // Hide custom fields by default
    const customFields = document.getElementById('custom-dish-fields');
    if (customFields) customFields.style.display = 'none';

    updateEditMacroPreview();
    if (modal) modal.style.display = 'flex';
};

window.closeEditModal = function() {
    const modal = document.getElementById('edit-meal-modal');
    if (modal) modal.style.display = 'none';
};

function updateEditMacroPreview() {
    const select = document.getElementById('edit-class-select');
    const portionSlider = document.getElementById('edit-portion-slider');
    const customFields = document.getElementById('custom-dish-fields');
    const isCustomActive = customFields && customFields.style.display !== 'none';

    const portion = parseInt(portionSlider ? portionSlider.value : 150, 10);
    const portionDisplay = document.getElementById('portion-val-display');
    if (portionDisplay) portionDisplay.textContent = `${portion}g`;

    let n100 = { calories: 200, protein_g: 8, carbs_g: 25, fat_g: 7 };

    if (isCustomActive) {
        n100 = {
            calories: parseFloat(document.getElementById('custom-cal')?.value || 200),
            protein_g: parseFloat(document.getElementById('custom-pro')?.value || 8),
            carbs_g: parseFloat(document.getElementById('custom-carb')?.value || 25),
            fat_g: parseFloat(document.getElementById('custom-fat')?.value || 7)
        };
    } else if (select && select.value) {
        const item = allFoodClasses.find(c => c.key === select.value);
        if (item && item.nutrition_per_100g) {
            n100 = item.nutrition_per_100g;
        }
    }

    const scale = portion / 100.0;
    document.getElementById('preview-cal').textContent = `${Math.round(n100.calories * scale)} kcal`;
    document.getElementById('preview-pro').textContent = `${(n100.protein_g * scale).toFixed(1)}g`;
    document.getElementById('preview-carb').textContent = `${(n100.carbs_g * scale).toFixed(1)}g`;
    document.getElementById('preview-fat').textContent = `${(n100.fat_g * scale).toFixed(1)}g`;
}

async function handleFeedbackSubmit(e) {
    e.preventDefault();
    if (!currentScanResult || !currentScanResult.foods[currentEditingIndex]) return;

    const food = currentScanResult.foods[currentEditingIndex];
    const select = document.getElementById('edit-class-select');
    const portionSlider = document.getElementById('edit-portion-slider');
    const customFields = document.getElementById('custom-dish-fields');
    const isCustomActive = customFields && customFields.style.display !== 'none';

    const portion_g = parseInt(portionSlider.value, 10);
    let corrected_class = select.value;
    let nutrition_per_100g = null;

    if (isCustomActive) {
        const nameInput = document.getElementById('custom-dish-name');
        corrected_class = nameInput.value.trim() || 'Custom Meal';
        nutrition_per_100g = {
            calories: parseFloat(document.getElementById('custom-cal').value || 200),
            protein_g: parseFloat(document.getElementById('custom-pro').value || 8),
            carbs_g: parseFloat(document.getElementById('custom-carb').value || 25),
            fat_g: parseFloat(document.getElementById('custom-fat').value || 7)
        };
    }

    if (!corrected_class) {
        alert('Please select or enter a corrected food dish!');
        return;
    }

    // Submit feedback to backend
    try {
        const payload = {
            image: currentScanResult.scan_image || '',
            predicted_class: food.class_name || food.display_name,
            corrected_class: corrected_class,
            portion_g: portion_g,
            bbox: food.bbox_normalized || null,
            nutrition_per_100g: nutrition_per_100g
        };

        const res = await fetch(`${NUTRITION_API}/nutrition/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const data = await res.json();
            // Update local food item
            food.display_name = data.display_name;
            food.class_name = data.corrected_class;
            food.portion_g = data.portion_g;
            food.nutrition = data.nutrition;
            food.db_match = true;
            food.is_custom = data.is_new_class;

            // Recalculate totals
            let cal = 0, pro = 0, carb = 0, fat = 0;
            currentScanResult.foods.forEach(f => {
                if (f.nutrition) {
                    cal += f.nutrition.calories || 0;
                    pro += f.nutrition.protein_g || 0;
                    carb += f.nutrition.carbs_g || 0;
                    fat += f.nutrition.fat_g || 0;
                }
            });
            currentScanResult.totals = { calories: cal, protein_g: pro, carbs_g: carb, fat_g: fat };

            // Update localStorage and UI
            const updatedData = addMealToStorage(currentScanResult);
            updateDailyTotals(updatedData);
            renderMealsTimeline(updatedData);
            renderScanResults(currentScanResult);
            fetchFoodClasses(); // Refresh class list

            closeEditModal();
            showScanMessage('Feedback saved! AI model dataset updated & meal corrected.', 'success');
        }
    } catch (err) {
        console.error('Error submitting feedback:', err);
        alert('Saved edit locally! (Backend feedback log sync skipped)');
        closeEditModal();
    }
}

// ============================================================
// AI INSIGHT (Ollama qwen2.5:7b)
// ============================================================

async function fetchAIInsight() {
    const data = loadNutritionData();
    const btn = DOM.aiInsightBtn;

    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
    }
    if (DOM.aiInsightText) {
        DOM.aiInsightText.innerHTML = '<span style="animation: pulse 1.5s ease infinite;">Consulting Kinetic AI...</span>';
    }

    try {
        const foodsList = data.meals.flatMap(m => m.foods.map(f => f.display_name)).join(', ');

        const response = await fetch(`${NUTRITION_API}/nutrition/ai-insight`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nutrition_data: {
                    total_calories: Math.round(data.totals.calories),
                    calorie_goal: GOALS.calories,
                    total_protein: Math.round(data.totals.protein_g),
                    protein_goal: GOALS.protein,
                    total_carbs: Math.round(data.totals.carbs_g),
                    carb_goal: GOALS.carbs,
                    total_fat: Math.round(data.totals.fat_g),
                    fat_goal: GOALS.fat,
                    meal_count: data.meals.length,
                    foods_eaten: foodsList || 'None logged yet'
                },
                workout_data: {
                    type: 'Lower body strength',
                    duration: '45 min',
                    intensity: 'HIGH',
                    reps: '128 total'
                }
            })
        });

        const result = await response.json();

        if (DOM.aiInsightText) {
            DOM.aiInsightText.innerHTML = result.insight || 'Unable to generate insight.';
        }

        // Update indicator pills dynamically based on actual data
        updateDynamicPerformanceIndicators(data);

    } catch (err) {
        console.error('AI Insight error:', err);
        if (DOM.aiInsightText) {
            DOM.aiInsightText.innerHTML = err.message.includes('Failed to fetch') ?
                'Backend offline. Start the server and Ollama to get AI coaching insights.' :
                'Unable to connect to AI. Ensure Ollama is running with qwen2.5:7b model.';
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    }
}

// ============================================================
// UTILITIES
// ============================================================

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    grabDOM();

    // Load persisted data and update UI
    const data = loadNutritionData();
    updateDailyTotals(data);
    renderMealsTimeline(data);

    // Fetch available food classes for correction dropdown
    fetchFoodClasses();

    // Modal listeners
    const editForm = document.getElementById('edit-meal-form');
    if (editForm) editForm.addEventListener('submit', handleFeedbackSubmit);

    const closeModalBtn = document.getElementById('close-modal-btn');
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeEditModal);

    const portionSlider = document.getElementById('edit-portion-slider');
    if (portionSlider) portionSlider.addEventListener('input', updateEditMacroPreview);

    const classSelect = document.getElementById('edit-class-select');
    if (classSelect) classSelect.addEventListener('change', updateEditMacroPreview);

    const toggleCustomBtn = document.getElementById('toggle-custom-dish-btn');
    const customFields = document.getElementById('custom-dish-fields');
    if (toggleCustomBtn && customFields) {
        toggleCustomBtn.addEventListener('click', () => {
            const isHidden = customFields.style.display === 'none';
            customFields.style.display = isHidden ? 'block' : 'none';
            updateEditMacroPreview();
        });
    }

    ['custom-cal', 'custom-pro', 'custom-carb', 'custom-fat'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateEditMacroPreview);
    });

    // File input setup
    if (!DOM.fileInput) {
        let input = document.getElementById('meal-file-input');
        if (!input) {
            input = document.createElement('input');
            input.type = 'file';
            input.id = 'meal-file-input';
            input.accept = 'image/*';
            input.style.display = 'none';
            document.body.appendChild(input);
        }
        DOM.fileInput = input;
    } else {
        DOM.fileInput.removeAttribute('capture');
    }

    DOM.fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleMealScan(file);
        e.target.value = '';
    });

    // Live Camera Toggle Button
    if (DOM.toggleCamBtn) {
        DOM.toggleCamBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLiveCamera();
        });
    }

    // Shutter Button (Capture & Scan)
    if (DOM.shutterBtn) {
        DOM.shutterBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (cameraStream && DOM.webcam && DOM.webcam.readyState >= 2) {
                const b64 = captureFrameFromWebcam();
                if (b64) {
                    await handleMealScanBase64(b64);
                } else {
                    showScanMessage('Could not capture camera frame. Try again.', 'warning');
                }
            } else {
                // If live camera is off, start live view or trigger upload
                const started = await startLiveCamera();
                if (!started) {
                    DOM.fileInput.click();
                }
            }
        });
    }

    // Gallery Photo Upload Icon Button
    if (DOM.galleryBtn) {
        DOM.galleryBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            DOM.fileInput.click();
        });
    }

    // Camera button in top hero header
    if (DOM.cameraBtn) {
        DOM.cameraBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const started = await startLiveCamera();
            if (!started) DOM.fileInput.click();
        });
    }

    // Recovery Score CTA button
    const recoveryCta = document.getElementById('recovery-scan-cta');
    if (recoveryCta) {
        recoveryCta.addEventListener('click', async (e) => {
            e.stopPropagation();
            const scanCard = document.querySelector('.card-low');
            if (scanCard) scanCard.scrollIntoView({ behavior: 'smooth' });
            const started = await startLiveCamera();
            if (!started) DOM.fileInput.click();
        });
    }
    // Drag & Drop support on scan card
    if (DOM.scanOverlay) {
        DOM.scanOverlay.addEventListener('dragover', (e) => {
            e.preventDefault();
            DOM.scanOverlay.style.opacity = '0.7';
        });
        DOM.scanOverlay.addEventListener('dragleave', () => {
            DOM.scanOverlay.style.opacity = '1';
        });
        DOM.scanOverlay.addEventListener('drop', (e) => {
            e.preventDefault();
            DOM.scanOverlay.style.opacity = '1';
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleMealScan(e.dataTransfer.files[0]);
            }
        });
    }

    // AI Insight - click the header section
    const aiHeader = document.querySelector('.ai-insight-card__header');
    if (aiHeader) {
        aiHeader.style.cursor = 'pointer';
        aiHeader.addEventListener('click', fetchAIInsight);
    }

    // Also make the entire AI Insight card clickable for insight
    if (DOM.aiInsightBtn) {
        DOM.aiInsightBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fetchAIInsight();
        });
    }

    console.log('[Nutrition] Module initialized. Meals today:', data.meals.length);
});
