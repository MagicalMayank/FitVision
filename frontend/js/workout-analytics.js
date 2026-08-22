/**
 * Workout Analytics Component Engine
 * Handles segmented control (Overview, Performance, Progress, History)
 * and dynamic data rendering from localStorage + Backend AI endpoints.
 */

class WorkoutAnalytics {
  constructor() {
    this.currentSegment = 'overview';
    this.history = [];
    this.lastSession = null;
    this.timeRange = '7D'; // Default time range for Progress panel

    this.init();
  }

  init() {
    this.loadData();
    this.setupSegmentedControl();
    this.setupTimeRangeSelector();
    this.handleHashChange();
    this.renderActiveSegment();

    // Listen for hash changes
    window.addEventListener('hashchange', () => this.handleHashChange());
    
    // Listen for custom workout completed event to update analytics in real time
    window.addEventListener('workoutCompleted', () => {
      this.loadData();
      this.renderActiveSegment();
    });
  }

  loadData() {
    try {
      const storedHistory = localStorage.getItem('kinetic_workout_history');
      this.history = storedHistory ? JSON.parse(storedHistory) : [];

      const storedSession = localStorage.getItem('kinetic_last_workout_session');
      this.lastSession = storedSession ? JSON.parse(storedSession) : null;
    } catch (e) {
      console.warn('Failed to parse workout analytics data from localStorage:', e);
      this.history = [];
      this.lastSession = null;
    }

    // Default sample data generator if 0 workouts logged yet, so user sees realistic structure populated with existing data logic
    if (this.history.length === 0 && !this.lastSession) {
      const defaultPastSessions = [
        {
          id: 'session_def_1',
          exercise: 'Squat',
          date: new Date(Date.now() - 86400000).toISOString(),
          timestamp: new Date(Date.now() - 86400000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          duration: '14:22',
          durationSec: 862,
          reps: 48,
          calories: 145,
          accuracy: 92,
          notes: 'Optimal Form Precision'
        },
        {
          id: 'session_def_2',
          exercise: 'Push-up',
          date: new Date(Date.now() - 172800000).toISOString(),
          timestamp: new Date(Date.now() - 172800000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          duration: '10:15',
          durationSec: 615,
          reps: 60,
          calories: 110,
          accuracy: 88,
          notes: 'Slight fatigue on last set'
        },
        {
          id: 'session_def_3',
          exercise: 'Lunge',
          date: new Date(Date.now() - 259200000).toISOString(),
          timestamp: new Date(Date.now() - 259200000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          duration: '12:00',
          durationSec: 720,
          reps: 40,
          calories: 125,
          accuracy: 90,
          notes: 'Great knee stability'
        }
      ];

      this.history = defaultPastSessions;
      this.lastSession = defaultPastSessions[0];
    }
  }

  setupSegmentedControl() {
    const segmentBtns = document.querySelectorAll('.segment-btn');
    segmentBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetSegment = btn.getAttribute('data-segment');
        if (targetSegment) {
          this.switchSegment(targetSegment);
        }
      });
    });
  }

  setupTimeRangeSelector() {
    document.addEventListener('click', (e) => {
      const pill = e.target.closest('.time-range-pill');
      if (pill) {
        document.querySelectorAll('.time-range-pill').forEach(p => {
          p.style.background = 'var(--surface-container-high)';
          p.style.color = 'var(--on-surface-variant)';
        });
        pill.style.background = 'var(--primary-fixed)';
        pill.style.color = 'var(--on-primary-fixed)';
        this.timeRange = pill.getAttribute('data-range') || '7D';
        this.renderProgressPanel();
      }
    });
  }

  handleHashChange() {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    const validSegments = ['overview', 'performance', 'progress', 'history'];
    if (validSegments.includes(hash)) {
      this.switchSegment(hash, false);
      const analyticsContainer = document.getElementById('workout-analytics-section');
      if (analyticsContainer) {
        analyticsContainer.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (hash === 'analytics') {
      this.switchSegment('overview', false);
    }
  }

  switchSegment(segmentName, updateHash = true) {
    this.currentSegment = segmentName;

    // Update Segmented Control Buttons UI
    const segmentBtns = document.querySelectorAll('.segment-btn');
    segmentBtns.forEach(btn => {
      const isTarget = btn.getAttribute('data-segment') === segmentName;
      if (isTarget) {
        btn.classList.add('segment-btn--active');
        btn.setAttribute('aria-selected', 'true');
      } else {
        btn.classList.remove('segment-btn--active');
        btn.setAttribute('aria-selected', 'false');
      }
    });

    // Update Panels Visibility
    const panels = document.querySelectorAll('.analytics-panel');
    panels.forEach(panel => {
      if (panel.id === `panel-${segmentName}`) {
        panel.classList.add('analytics-panel--active');
      } else {
        panel.classList.remove('analytics-panel--active');
      }
    });

    // Update Hash if requested
    if (updateHash && window.location.hash !== `#${segmentName}`) {
      history.replaceState(null, null, `#${segmentName}`);
    }

    this.renderActiveSegment();
  }

  renderActiveSegment() {
    switch (this.currentSegment) {
      case 'overview':
        this.renderOverviewPanel();
        break;
      case 'performance':
        this.renderPerformancePanel();
        break;
      case 'progress':
        this.renderProgressPanel();
        break;
      case 'history':
        this.renderHistoryPanel();
        break;
    }
  }

  // --- OVERVIEW PANEL ---
  renderOverviewPanel() {
    const panel = document.getElementById('panel-overview');
    if (!panel) return;

    // Calculate aggregated metrics from real history
    const totalWorkouts = this.history.length;
    let totalSec = 0;
    let totalCalories = 0;
    let totalReps = 0;
    let totalAccuracySum = 0;

    this.history.forEach(item => {
      totalSec += (item.durationSec || 600);
      totalCalories += (item.calories || 100);
      totalReps += (item.reps || 30);
      totalAccuracySum += (item.accuracy || 85);
    });

    const totalMinutes = Math.round(totalSec / 60);
    const avgAccuracy = totalWorkouts > 0 ? Math.round(totalAccuracySum / totalWorkouts) : 90;

    // Recent session
    const recent = this.lastSession || (this.history.length > 0 ? this.history[0] : null);

    panel.innerHTML = `
      <!-- Daily Summary Card -->
      <div class="card" style="padding: 1.5rem; margin-bottom: 1.5rem; background: var(--surface-container); border: 1px solid rgba(71,72,50,0.15);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <div>
            <span class="text-label-sm" style="color: var(--secondary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">DAILY ACTIVITY</span>
            <h3 class="font-headline" style="color: white; font-weight: 700; font-size: 1.25rem; margin-top: 0.25rem;">Target: 60 Mins Active</h3>
          </div>
          <div style="background: rgba(126,219,127,0.15); border: 1px solid rgba(126,219,127,0.3); padding: 0.35rem 0.75rem; border-radius: var(--radius-full); color: var(--secondary); font-size: 0.75rem; font-weight: 700;">
            ${Math.min(100, Math.round((totalMinutes / 60) * 100))}% Goal
          </div>
        </div>
        <div class="progress-bar" style="height: 0.5rem; background: var(--surface-variant); border-radius: var(--radius-full); overflow: hidden;">
          <div class="progress-bar__fill" style="width: ${Math.min(100, Math.round((totalMinutes / 60) * 100))}%; background: linear-gradient(90deg, var(--secondary), var(--primary-fixed)); height: 100%;"></div>
        </div>
      </div>

      <!-- Quick Metrics Grid -->
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
        <div class="card-high" style="padding: 1.25rem; text-align: left;">
          <span class="material-symbols-outlined" style="color: var(--primary-fixed); font-size: 1.5rem;">fitness_center</span>
          <span style="display: block; font-size: 0.7rem; color: var(--on-surface-variant); margin-top: 0.5rem; text-transform: uppercase; font-weight: 700;">Total Workouts</span>
          <span class="font-headline" style="font-size: 1.75rem; font-weight: 900; color: white;">${totalWorkouts}</span>
        </div>
        <div class="card-high" style="padding: 1.25rem; text-align: left;">
          <span class="material-symbols-outlined" style="color: var(--secondary); font-size: 1.5rem;">timer</span>
          <span style="display: block; font-size: 0.7rem; color: var(--on-surface-variant); margin-top: 0.5rem; text-transform: uppercase; font-weight: 700;">Active Time</span>
          <span class="font-headline" style="font-size: 1.75rem; font-weight: 900; color: white;">${totalMinutes}<span style="font-size: 1rem; opacity: 0.6; font-weight: 500;">m</span></span>
        </div>
        <div class="card-high" style="padding: 1.25rem; text-align: left;">
          <span class="material-symbols-outlined" style="color: #ff9800; font-size: 1.5rem;">local_fire_department</span>
          <span style="display: block; font-size: 0.7rem; color: var(--on-surface-variant); margin-top: 0.5rem; text-transform: uppercase; font-weight: 700;">Calories Burned</span>
          <span class="font-headline" style="font-size: 1.75rem; font-weight: 900; color: white;">${totalCalories}<span style="font-size: 0.9rem; opacity: 0.6; font-weight: 500;">kcal</span></span>
        </div>
        <div class="card-high" style="padding: 1.25rem; text-align: left;">
          <span class="material-symbols-outlined" style="color: #00bcd4; font-size: 1.5rem;">verified</span>
          <span style="display: block; font-size: 0.7rem; color: var(--on-surface-variant); margin-top: 0.5rem; text-transform: uppercase; font-weight: 700;">Avg Accuracy</span>
          <span class="font-headline" style="font-size: 1.75rem; font-weight: 900; color: white;">${avgAccuracy}%</span>
        </div>
      </div>

      <!-- Recent Workout Summary Card -->
      ${recent ? `
      <div class="card" style="padding: 1.5rem; margin-bottom: 1.5rem; border-left: 4px solid var(--primary-fixed);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
          <div>
            <span class="text-label-sm" style="color: var(--on-surface-variant); font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em;">LATEST COMPLETED SESSION</span>
            <h4 class="font-headline" style="color: white; font-weight: 700; font-size: 1.15rem; margin-top: 0.15rem;">${recent.exercise.toUpperCase()} SESSION</h4>
          </div>
          <span class="badge" style="background: rgba(245,255,0,0.1); color: var(--primary-fixed); font-size: 0.7rem; font-weight: 700; padding: 0.25rem 0.6rem; border-radius: var(--radius-sm);">
            ${recent.accuracy}% Accuracy
          </span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-top: 1rem; background: var(--surface-container-highest); padding: 0.75rem; border-radius: var(--radius-sm); text-align: center;">
          <div>
            <span style="font-size: 0.65rem; color: var(--on-surface-variant); display: block;">Reps</span>
            <span class="font-headline" style="font-weight: 700; color: white;">${recent.reps}</span>
          </div>
          <div>
            <span style="font-size: 0.65rem; color: var(--on-surface-variant); display: block;">Duration</span>
            <span class="font-headline" style="font-weight: 700; color: white;">${recent.duration}</span>
          </div>
          <div>
            <span style="font-size: 0.65rem; color: var(--on-surface-variant); display: block;">Burn</span>
            <span class="font-headline" style="font-weight: 700; color: var(--primary-fixed);">${recent.calories} kcal</span>
          </div>
        </div>
      </div>
      ` : ''}

      <!-- Kinetic AI Oracle Insight -->
      <div class="ai-insight-card glass-panel" style="border: 1px solid rgba(245, 255, 0, 0.2);">
        <div class="ai-insight-card__header">
          <span class="material-symbols-outlined">auto_awesome</span>
          <span class="ai-insight-card__title">ORACLE INSIGHT</span>
        </div>
        <p id="overview-ai-text" class="ai-insight-card__body">
          "Your average form accuracy is ${avgAccuracy}%. Kinetic AI identifies strength in initial sets. Keep core tight on depth cycles."
        </p>
      </div>
    `;

    this.fetchAiInsight();
  }

  // --- PERFORMANCE PANEL ---
  renderPerformancePanel() {
    const panel = document.getElementById('panel-performance');
    if (!panel) return;

    // Group exercise scores
    const exerciseScores = {
      'Squat': 92,
      'Push-up': 88,
      'Lunge': 90,
      'Glute Bridge': 94,
      'Plank': 89,
      'Bicep Curl': 95,
      'Shoulder Press': 91,
      'Calf Raise': 93
    };

    // Replace with real session scores if available
    this.history.forEach(item => {
      if (item.exercise && item.accuracy) {
        exerciseScores[item.exercise] = item.accuracy;
      }
    });

    panel.innerHTML = `
      <!-- Exercise Form Accuracy Breakdown -->
      <div class="card" style="padding: 1.5rem; margin-bottom: 1.5rem;">
        <h3 class="font-headline" style="color: white; font-weight: 700; font-size: 1.1rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          <span class="material-symbols-outlined" style="color: var(--primary-fixed);">biometrics</span>
          Exercise Form Scores &amp; Precision
        </h3>
        <div style="display: flex; flex-direction: column; gap: 0.85rem;">
          ${Object.entries(exerciseScores).map(([exName, score]) => `
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.25rem;">
                <span style="color: white; font-weight: 600;">${exName}</span>
                <span style="color: var(--primary-fixed); font-weight: 700;">${score}%</span>
              </div>
              <div style="height: 0.5rem; background: var(--surface-container-highest); border-radius: var(--radius-full); overflow: hidden;">
                <div style="width: ${score}%; height: 100%; background: linear-gradient(90deg, var(--secondary), var(--primary-fixed)); border-radius: var(--radius-full);"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Biomechanical Precision & Form Deviation Alerts -->
      <div class="card" style="padding: 1.5rem; margin-bottom: 1.5rem; border-left: 4px solid var(--secondary);">
        <h3 class="font-headline" style="color: white; font-weight: 700; font-size: 1.1rem; margin-bottom: 0.75rem;">
          Biomechanical Form Deviations &amp; Fatigue
        </h3>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <div style="background: var(--surface-container-highest); padding: 0.85rem; border-radius: var(--radius-sm); display: flex; align-items: flex-start; gap: 0.75rem;">
            <span class="material-symbols-outlined" style="color: var(--secondary);">check_circle</span>
            <div>
              <span style="display: block; font-weight: 700; font-size: 0.85rem; color: white;">Optimal Depth &amp; Tempo Stability</span>
              <span style="font-size: 0.75rem; color: var(--on-surface-variant);">Maintained >85° hip flexion angle across sets 1-3.</span>
            </div>
          </div>
          <div style="background: var(--surface-container-highest); padding: 0.85rem; border-radius: var(--radius-sm); display: flex; align-items: flex-start; gap: 0.75rem;">
            <span class="material-symbols-outlined" style="color: #ff9800;">warning</span>
            <div>
              <span style="display: block; font-weight: 700; font-size: 0.85rem; color: white;">Knee Valgus Warning (Late Reps)</span>
              <span style="font-size: 0.75rem; color: var(--on-surface-variant);">Minor inward knee drift detected on rep 12 onwards. Focus on glute activation.</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Vitals & Energy Curve -->
      <div class="card" style="padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <div>
            <h3 class="font-headline" style="color: white; font-weight: 700; font-size: 1.1rem;">Vitals &amp; Heart Rate Curve</h3>
            <span style="font-size: 0.75rem; color: var(--on-surface-variant);">Peak HR: 164 BPM • Resting HR: 58 BPM</span>
          </div>
          <span class="material-symbols-outlined" style="color: #e91e63;">favorite</span>
        </div>
        <div style="height: 7rem; width: 100%; position: relative; margin-top: 1rem;">
          <svg viewBox="0 0 100 35" preserveAspectRatio="none" style="width: 100%; height: 100%; overflow: visible;">
            <path d="M0 25 Q 15 10, 30 18 T 60 8 T 85 20 T 100 12" fill="none" stroke="#e91e63" stroke-width="2" style="filter: drop-shadow(0 0 6px rgba(233,30,99,0.5));"></path>
          </svg>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.65rem; color: var(--on-surface-variant); margin-top: 0.5rem;">
          <span>Warmup (110 BPM)</span>
          <span>Peak Set (164 BPM)</span>
          <span>Cooldown (118 BPM)</span>
        </div>
      </div>
    `;
  }

  // --- PROGRESS PANEL ---
  renderProgressPanel() {
    const panel = document.getElementById('panel-progress');
    if (!panel) return;

    panel.innerHTML = `
      <!-- Time Range Selector -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
        <h3 class="font-headline" style="color: white; font-weight: 700; font-size: 1.1rem;">Longitudinal Trends</h3>
        <div style="display: flex; gap: 0.35rem; background: var(--surface-container-high); padding: 0.2rem; border-radius: var(--radius-full); border: 1px solid rgba(255,255,255,0.08);">
          <button class="time-range-pill" data-range="7D" style="padding: 0.3rem 0.75rem; border-radius: var(--radius-full); font-size: 0.7rem; font-weight: 700; border: none; cursor: pointer; background: ${this.timeRange === '7D' ? 'var(--primary-fixed)' : 'transparent'}; color: ${this.timeRange === '7D' ? 'var(--on-primary-fixed)' : 'var(--on-surface-variant)'};">7D</button>
          <button class="time-range-pill" data-range="30D" style="padding: 0.3rem 0.75rem; border-radius: var(--radius-full); font-size: 0.7rem; font-weight: 700; border: none; cursor: pointer; background: ${this.timeRange === '30D' ? 'var(--primary-fixed)' : 'transparent'}; color: ${this.timeRange === '30D' ? 'var(--on-primary-fixed)' : 'var(--on-surface-variant)'};">30D</button>
          <button class="time-range-pill" data-range="90D" style="padding: 0.3rem 0.75rem; border-radius: var(--radius-full); font-size: 0.7rem; font-weight: 700; border: none; cursor: pointer; background: ${this.timeRange === '90D' ? 'var(--primary-fixed)' : 'transparent'}; color: ${this.timeRange === '90D' ? 'var(--on-primary-fixed)' : 'var(--on-surface-variant)'};">90D</button>
        </div>
      </div>

      <!-- Weekly Frequency Visualizer -->
      <div class="card" style="padding: 1.5rem; margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.5rem;">
          <div>
            <span class="text-label-sm" style="color: var(--secondary); font-weight: 700; text-transform: uppercase;">WORKOUT FREQUENCY</span>
            <h4 class="font-headline" style="color: white; font-weight: 700; font-size: 1.25rem; margin-top: 0.25rem;">5 Days Logged This Week</h4>
          </div>
          <span class="font-headline" style="color: var(--primary-fixed); font-weight: 900; font-size: 1.25rem;">+15% vs Last Week</span>
        </div>

        <div class="perf-bars" style="margin-top: 1rem; height: 7rem; align-items: flex-end;">
          <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:0.3rem;">
            <div class="perf-bar" style="height: 60%; width: 100%; background: var(--surface-container-highest);"></div>
            <span style="font-size:0.6rem; color:var(--on-surface-variant);">MON</span>
          </div>
          <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:0.3rem;">
            <div class="perf-bar" style="height: 85%; width: 100%; background: var(--secondary);"></div>
            <span style="font-size:0.6rem; color:var(--on-surface-variant);">TUE</span>
          </div>
          <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:0.3rem;">
            <div class="perf-bar" style="height: 40%; width: 100%; background: var(--surface-container-highest);"></div>
            <span style="font-size:0.6rem; color:var(--on-surface-variant);">WED</span>
          </div>
          <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:0.3rem;">
            <div class="perf-bar" style="height: 95%; width: 100%; background: var(--primary-fixed);"></div>
            <span style="font-size:0.6rem; color:var(--on-surface-variant);">THU</span>
          </div>
          <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:0.3rem;">
            <div class="perf-bar" style="height: 70%; width: 100%; background: var(--secondary);"></div>
            <span style="font-size:0.6rem; color:var(--on-surface-variant);">FRI</span>
          </div>
          <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:0.3rem;">
            <div class="perf-bar" style="height: 90%; width: 100%; background: var(--primary-fixed);"></div>
            <span style="font-size:0.6rem; color:var(--on-surface-variant);">SAT</span>
          </div>
          <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:0.3rem;">
            <div class="perf-bar" style="height: 30%; width: 100%; background: var(--surface-container-highest);"></div>
            <span style="font-size:0.6rem; color:var(--on-surface-variant);">SUN</span>
          </div>
        </div>
      </div>

      <!-- Weekly Objectives & Streaks -->
      <div class="card" style="padding: 1.5rem;">
        <h3 class="font-headline" style="color: white; font-weight: 700; font-size: 1.1rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          <span class="material-symbols-outlined" style="color: var(--primary-fixed);">military_tech</span>
          Weekly Objectives &amp; Streaks
        </h3>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.35rem;">
              <span style="color: white; font-weight: 600;">Strength Training Goal</span>
              <span style="color: var(--secondary); font-weight: 700;">4 / 5 Days Completed</span>
            </div>
            <div style="height: 0.5rem; background: var(--surface-container-highest); border-radius: var(--radius-full); overflow: hidden;">
              <div style="width: 80%; height: 100%; background: var(--secondary);"></div>
            </div>
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.35rem;">
              <span style="color: white; font-weight: 600;">Mobility &amp; Core Goal</span>
              <span style="color: var(--primary-fixed); font-weight: 700;">2 / 3 Days Completed</span>
            </div>
            <div style="height: 0.5rem; background: var(--surface-container-highest); border-radius: var(--radius-full); overflow: hidden;">
              <div style="width: 66%; height: 100%; background: var(--primary-fixed);"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- HISTORY PANEL ---
  renderHistoryPanel() {
    const panel = document.getElementById('panel-history');
    if (!panel) return;

    if (this.history.length === 0) {
      panel.innerHTML = `
        <div class="card" style="padding: 3rem 1.5rem; text-align: center;">
          <span class="material-symbols-outlined" style="font-size: 3rem; color: var(--on-surface-variant); margin-bottom: 1rem;">history</span>
          <h3 class="font-headline" style="color: white; font-size: 1.2rem; font-weight: 700;">No Past Workouts Logged</h3>
          <p style="color: var(--on-surface-variant); font-size: 0.85rem; margin-top: 0.5rem;">Start your first active workout above to begin tracking history.</p>
        </div>
      `;
      return;
    }

    panel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 class="font-headline" style="color: white; font-weight: 700; font-size: 1.1rem;">Session History Timeline</h3>
        <span style="font-size: 0.75rem; color: var(--on-surface-variant);">${this.history.length} Sessions Logged</span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${this.history.map(item => {
          const dateStr = item.date ? new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Recent';
          const timeStr = item.timestamp || '';
          return `
            <div class="card-high" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; border: 1px solid rgba(255,255,255,0.06);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <div style="width: 2.5rem; height: 2.5rem; border-radius: var(--radius-sm); background: var(--surface-container-lowest); display: flex; align-items: center; justify-content: center; color: var(--primary-fixed);">
                    <span class="material-symbols-outlined">fitness_center</span>
                  </div>
                  <div>
                    <h4 class="font-headline" style="color: white; font-weight: 700; font-size: 1rem;">${(item.exercise || 'Workout').toUpperCase()}</h4>
                    <span style="font-size: 0.7rem; color: var(--on-surface-variant);">${dateStr} • ${timeStr}</span>
                  </div>
                </div>
                <span class="badge" style="background: rgba(126,219,127,0.15); color: var(--secondary); font-size: 0.7rem; font-weight: 700; padding: 0.25rem 0.5rem; border-radius: var(--radius-sm);">
                  ${item.accuracy || 90}% Accuracy
                </span>
              </div>

              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; background: var(--surface-container-highest); padding: 0.6rem; border-radius: var(--radius-sm); text-align: center; font-size: 0.8rem;">
                <div>
                  <span style="display: block; font-size: 0.65rem; color: var(--on-surface-variant);">Reps</span>
                  <span style="font-weight: 700; color: white;">${item.reps || 0}</span>
                </div>
                <div>
                  <span style="display: block; font-size: 0.65rem; color: var(--on-surface-variant);">Duration</span>
                  <span style="font-weight: 700; color: white;">${item.duration || '10:00'}</span>
                </div>
                <div>
                  <span style="display: block; font-size: 0.65rem; color: var(--on-surface-variant);">Calories</span>
                  <span style="font-weight: 700; color: var(--primary-fixed);">${item.calories || 100} kcal</span>
                </div>
              </div>

              <button class="btn-history-summary" onclick="window.location.href='session-summary.html'" style="background: transparent; border: 1px solid rgba(255,255,255,0.1); color: var(--on-surface); font-size: 0.75rem; font-weight: 700; padding: 0.5rem; border-radius: var(--radius-sm); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.35rem; transition: background 0.2s;">
                <span>View Session Summary</span>
                <span class="material-symbols-outlined" style="font-size: 0.9rem;">arrow_forward</span>
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  async fetchAiInsight() {
    try {
      const response = await fetch('/workout/ai-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: this.history,
          lastSession: this.lastSession
        })
      });

      if (response.ok) {
        const data = await response.json();
        const insightElem = document.getElementById('overview-ai-text');
        if (insightElem && data.insight) {
          insightElem.textContent = `"${data.insight}"`;
        }
      }
    } catch (e) {
      console.log('AI Insight endpoint fallback to deterministic logic.');
    }
  }
}

// Initialize when DOM content is ready
document.addEventListener('DOMContentLoaded', () => {
  window.workoutAnalytics = new WorkoutAnalytics();
});
