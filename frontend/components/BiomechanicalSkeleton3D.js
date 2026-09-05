/**
 * components/BiomechanicalSkeleton3D.js
 * FitVision Real-Time 3D Biomechanical Skeleton Engine using Three.js & WebGL.
 * Consumes 17 YOLO pose keypoints directly from the live pose pipeline.
 *
 * Performance Features:
 * - Zero per-frame object allocations (pre-allocated vector pool & materials)
 * - Page Visibility API & Collapsible state render loop pausing
 * - Dynamic joint color states: Cyan (#00F5FF), Yellow (#F5FF00), Red (#FF3366)
 * - 60 FPS optimization with devicePixelRatio cap (max 2.0)
 */

class BiomechanicalSkeleton3D {
    constructor(containerId = 'biomechanics3DCanvasContainer', canvasId = 'biomechanics3DCanvas') {
        this.containerId = containerId;
        this.canvasId = canvasId;
        this.container = document.getElementById(containerId);
        this.canvas = document.getElementById(canvasId);

        this.initialized = false;
        this.isCollapsed = false;
        this.isTabVisible = !document.hidden;
        this.showGrid = true;
        this.animationFrameId = null;

        // 17 YOLO Keypoints definition (COCO standard index format)
        // 0: Nose, 1: L Eye, 2: R Eye, 3: L Ear, 4: R Ear, 5: L Shoulder, 6: R Shoulder,
        // 7: L Elbow, 8: R Elbow, 9: L Wrist, 10: R Wrist, 11: L Hip, 12: R Hip,
        // 13: L Knee, 14: R Knee, 15: L Ankle, 16: R Ankle
        this.KP = {
            NOSE: 0, LEFT_EYE: 1, RIGHT_EYE: 2, LEFT_EAR: 3, RIGHT_EAR: 4,
            LEFT_SHOULDER: 5, RIGHT_SHOULDER: 6, LEFT_ELBOW: 7, RIGHT_ELBOW: 8,
            LEFT_WRIST: 9, RIGHT_WRIST: 10, LEFT_HIP: 11, RIGHT_HIP: 12,
            LEFT_KNEE: 13, RIGHT_KNEE: 14, LEFT_ANKLE: 15, RIGHT_ANKLE: 16
        };

        // Bone connection pairs: [kpA, kpB, segmentCategory]
        this.boneConnections = [
            // Head / Face
            [0, 1, 'head'], [0, 2, 'head'], [1, 3, 'head'], [2, 4, 'head'],
            // Shoulders
            [5, 6, 'shoulders'],
            // Left Arm
            [5, 7, 'arm'], [7, 9, 'arm'],
            // Right Arm
            [6, 8, 'arm'], [8, 10, 'arm'],
            // Torso Sides
            [5, 11, 'torso'], [6, 12, 'torso'],
            // Hips
            [11, 12, 'hips'],
            // Left Leg
            [11, 13, 'leg'], [13, 15, 'leg'],
            // Right Leg
            [12, 14, 'leg'], [14, 16, 'leg']
        ];

        // Active target joints per exercise type
        this.activeJointsPerExercise = {
            squat: [11, 12, 13, 14, 15, 16],           // Hips, Knees, Ankles
            lunge: [11, 12, 13, 14, 15, 16],           // Hips, Knees, Ankles
            glute_bridge: [11, 12, 13, 14],            // Hips, Knees
            calf_raise: [13, 14, 15, 16],              // Knees, Ankles
            pushup: [5, 6, 7, 8, 9, 10],               // Shoulders, Elbows, Wrists
            bicep_curl: [5, 6, 7, 8, 9, 10],           // Shoulders, Elbows, Wrists
            shoulder_press: [5, 6, 7, 8, 9, 10],       // Shoulders, Elbows, Wrists
            plank: [5, 6, 11, 12],                     // Shoulders, Hips
            mountain_climber: [5, 6, 11, 12, 13, 14], // Shoulders, Hips, Knees
            jumping_jack: [5, 6, 9, 10, 15, 16]        // Shoulders, Wrists, Ankles
        };

        // Pre-allocated Keypoint 3D State array
        this.smoothedKeypoints = Array.from({ length: 17 }, () => ({
            pos: new THREE.Vector3(),
            target: new THREE.Vector3(),
            conf: 0,
            valid: false
        }));

        this.smoothingAlpha = 0.35; // EMA smoothing factor
        this.currentData = null;
        this.isLiveStream = false;

        // Post-Session Analysis state tracking
        this.worstPoseData = null;
        this.lastPoseData = null;
        this.sessionViolations = [];

        // Pre-allocated Vector & Quaternion Pool (Zero per-frame allocations)
        this.tempVecA = new THREE.Vector3();
        this.tempVecB = new THREE.Vector3();
        this.tempDir = new THREE.Vector3();
        this.tempAxis = new THREE.Vector3(0, 1, 0);
        this.midShoulder = new THREE.Vector3();
        this.midHip = new THREE.Vector3();

        // WebGL objects
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.jointMeshes = [];
        this.boneMeshes = [];
        this.gridHelper = null;
        this.spineMesh = null;
        this.neckMesh = null;

        // Colors (Strict Hex Specification)
        this.colors = {
            cyan: 0x00F5FF,    // #00F5FF = normal tracked joint
            yellow: 0xF5FF00,  // #F5FF00 = active target joint
            red: 0xFF3366,     // #FF3366 = form violation joint
            boneNormal: 0x7EDB7F,
            boneWarning: 0xFF3366,
            torsoSpine: 0x00E5FF
        };

        // Material cache (Pre-allocated once)
        this.materials = {};

        this.init();
    }

    resetSession() {
        this.worstPoseData = null;
        this.lastPoseData = null;
        this.sessionViolations = [];
        this.setStandbyPose();
    }

    init() {
        if (!this.container) this.container = document.getElementById(this.containerId);
        if (!this.canvas) this.canvas = document.getElementById(this.canvasId);

        if (typeof THREE === 'undefined') {
            console.warn('Three.js library is missing.');
            this.showFallbackMessage('Three.js loading...');
            return;
        }

        if (!this.container || !this.canvas) {
            console.warn('3D Canvas or container element not found.');
            return;
        }

        try {
            // Scene
            this.scene = new THREE.Scene();

            // Camera
            const width = this.container.clientWidth || 340;
            const height = this.container.clientHeight || 320;
            this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
            this.camera.position.set(0, 1.15, 3.2);

            // Renderer with performance cap
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: true,
                alpha: true,
                powerPreference: 'high-performance'
            });
            this.renderer.setSize(width, height);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

            // Orbit Controls (scoped strictly to 3D canvas)
            if (typeof THREE.OrbitControls !== 'undefined') {
                this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
                this.controls.enableDamping = true;
                this.controls.dampingFactor = 0.08;
                this.controls.target.set(0, 1.0, 0);
                this.controls.minDistance = 1.5;
                this.controls.maxDistance = 6.0;
                this.controls.maxPolarAngle = Math.PI / 2 + 0.15;
            }

            // Lights
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
            this.scene.add(ambientLight);

            const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.9);
            dirLight1.position.set(2, 4, 3);
            this.scene.add(dirLight1);

            const dirLight2 = new THREE.DirectionalLight(0x00f5ff, 0.5);
            dirLight2.position.set(-2, 1, -2);
            this.scene.add(dirLight2);

            // Grid Floor Helper
            this.gridHelper = new THREE.GridHelper(6, 20, 0x00f5ff, 0x222233);
            this.gridHelper.position.y = 0;
            this.scene.add(this.gridHelper);

            // Pre-create Materials Cache ONCE
            this.materials.jointNormal = new THREE.MeshStandardMaterial({
                color: this.colors.cyan,
                roughness: 0.2,
                metalness: 0.5,
                emissive: 0x003344,
                emissiveIntensity: 0.5
            });

            this.materials.jointActive = new THREE.MeshStandardMaterial({
                color: this.colors.yellow,
                roughness: 0.1,
                metalness: 0.8,
                emissive: 0x555500,
                emissiveIntensity: 0.8
            });

            this.materials.jointWarning = new THREE.MeshStandardMaterial({
                color: this.colors.red,
                roughness: 0.2,
                metalness: 0.5,
                emissive: 0x660011,
                emissiveIntensity: 0.9
            });

            this.materials.boneNormal = new THREE.MeshStandardMaterial({
                color: this.colors.boneNormal,
                roughness: 0.3,
                metalness: 0.2,
                transparent: true,
                opacity: 0.85
            });

            this.materials.boneWarning = new THREE.MeshStandardMaterial({
                color: this.colors.red,
                roughness: 0.3,
                metalness: 0.2,
                transparent: true,
                opacity: 0.95
            });

            this.materials.spineNormal = new THREE.MeshStandardMaterial({
                color: this.colors.torsoSpine,
                roughness: 0.2,
                metalness: 0.4,
                transparent: true,
                opacity: 0.9
            });

            // Reusable Geometries
            const sphereGeo = new THREE.SphereGeometry(0.035, 16, 16);
            const headGeo = new THREE.SphereGeometry(0.09, 16, 16);
            const cylinderGeo = new THREE.CylinderGeometry(0.016, 0.016, 1, 12);

            // Instantiate 17 Joint Sphere Meshes
            for (let i = 0; i < 17; i++) {
                const isNose = (i === 0);
                const mesh = new THREE.Mesh(isNose ? headGeo : sphereGeo, this.materials.jointNormal);
                mesh.visible = false;
                this.scene.add(mesh);
                this.jointMeshes.push(mesh);
            }

            // Instantiate Bone Cylinder Meshes
            for (let i = 0; i < this.boneConnections.length; i++) {
                const boneMesh = new THREE.Mesh(cylinderGeo, this.materials.boneNormal);
                boneMesh.visible = false;
                this.scene.add(boneMesh);
                this.boneMeshes.push(boneMesh);
            }

            // Spine & Neck Meshes
            this.spineMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 12), this.materials.spineNormal);
            this.spineMesh.visible = false;
            this.scene.add(this.spineMesh);

            this.neckMesh = new THREE.Mesh(cylinderGeo, this.materials.boneNormal);
            this.neckMesh.visible = false;
            this.scene.add(this.neckMesh);

            this.initialized = true;

            // Page Visibility API Handler (Pause render loop when tab hidden)
            this.visibilityHandler = () => {
                this.isTabVisible = !document.hidden;
                if (this.isTabVisible && !this.isCollapsed) {
                    this.startAnimationLoop();
                } else {
                    this.stopAnimationLoop();
                }
            };
            document.addEventListener('visibilitychange', this.visibilityHandler);

            // Resize listener
            this.resizeHandler = () => this.onResize();
            window.addEventListener('resize', this.resizeHandler);

            // Initial Standby Pose
            this.setStandbyPose();

            // Start animation loop if expanded
            if (!this.isCollapsed && this.isTabVisible) {
                this.startAnimationLoop();
            }
        } catch (err) {
            console.error('WebGL Initialization error in BiomechanicalSkeleton3D:', err);
            this.showFallbackMessage('WebGL Error: ' + err.message);
        }
    }

    startAnimationLoop() {
        if (!this.animationFrameId && this.initialized) {
            this.animate();
        }
    }

    stopAnimationLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    setCollapsed(collapsed) {
        this.isCollapsed = collapsed;
        if (this.isCollapsed) {
            this.stopAnimationLoop();
        } else if (this.isTabVisible) {
            this.startAnimationLoop();
            setTimeout(() => this.onResize(), 50);
        }
    }

    showFallbackMessage(msg) {
        const fb = document.getElementById('bio3dFallback');
        if (fb) {
            fb.style.display = 'flex';
            fb.querySelector('.bio3d-fallback-text').innerText = msg;
        }
    }

    hideFallbackMessage() {
        const fb = document.getElementById('bio3dFallback');
        if (fb) fb.style.display = 'none';
    }

    onResize() {
        if (!this.initialized || !this.container || !this.renderer || !this.camera) return;
        const width = this.container.clientWidth || 340;
        const height = this.container.clientHeight || 320;
        if (width === 0 || height === 0) return;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    resetCamera() {
        if (!this.camera || !this.controls) return;
        this.camera.position.set(0, 1.15, 3.2);
        this.controls.target.set(0, 1.0, 0);
        this.controls.update();
    }

    toggleGrid() {
        if (!this.gridHelper) return;
        this.showGrid = !this.showGrid;
        this.gridHelper.visible = this.showGrid;
    }

    setStandbyPose() {
        const standbyKP = [
            { x: 0.50, y: 0.15, conf: 0.9 }, { x: 0.48, y: 0.13, conf: 0.9 },
            { x: 0.52, y: 0.13, conf: 0.9 }, { x: 0.45, y: 0.14, conf: 0.9 },
            { x: 0.55, y: 0.14, conf: 0.9 }, { x: 0.40, y: 0.28, conf: 0.9 },
            { x: 0.60, y: 0.28, conf: 0.9 }, { x: 0.35, y: 0.44, conf: 0.9 },
            { x: 0.65, y: 0.44, conf: 0.9 }, { x: 0.32, y: 0.58, conf: 0.9 },
            { x: 0.68, y: 0.58, conf: 0.9 }, { x: 0.43, y: 0.54, conf: 0.9 },
            { x: 0.57, y: 0.54, conf: 0.9 }, { x: 0.43, y: 0.74, conf: 0.9 },
            { x: 0.57, y: 0.74, conf: 0.9 }, { x: 0.43, y: 0.92, conf: 0.9 },
            { x: 0.57, y: 0.92, conf: 0.9 }
        ];

        this.updatePose({
            keypoints: standbyKP,
            exercise: window.currentExercise || 'squat',
            phase: 'STANDBY',
            formScore: 100,
            violations: [],
            angles: {},
            feedback: 'Awaiting Vision Camera Stream...'
        }, false);
    }

    map2DTo3D(keypoints, exercise = 'squat') {
        if (!keypoints || keypoints.length < 17) return;

        const scaleX = 2.4;
        const scaleY = 2.2;
        const offsetY = 0.05;

        for (let i = 0; i < 17; i++) {
            const kp = keypoints[i];
            const sk = this.smoothedKeypoints[i];

            if (kp && kp.conf >= 0.2) {
                const tx = (0.5 - kp.x) * scaleX;
                const ty = (0.95 - kp.y) * scaleY + offsetY;
                sk.target.set(tx, ty, 0.0);
                sk.conf = kp.conf;
                sk.valid = true;
            } else {
                sk.valid = false;
            }
        }

        const skp = this.smoothedKeypoints;
        const lS = skp[this.KP.LEFT_SHOULDER];
        const rS = skp[this.KP.RIGHT_SHOULDER];
        const lH = skp[this.KP.LEFT_HIP];
        const rH = skp[this.KP.RIGHT_HIP];

        if (lS.valid && rS.valid) {
            const shoulderDistX = Math.abs(lS.target.x - rS.target.x);
            const refWidth = 0.48;
            if (shoulderDistX < refWidth) {
                const zOffset = Math.sqrt(Math.max(0, refWidth * refWidth - shoulderDistX * shoulderDistX));
                if (lS.target.x < rS.target.x) {
                    lS.target.z = zOffset * 0.4;
                    rS.target.z = -zOffset * 0.4;
                } else {
                    lS.target.z = -zOffset * 0.4;
                    rS.target.z = zOffset * 0.4;
                }
            }
        }

        if (lH.valid && rH.valid) {
            lH.target.z = (lS.valid ? lS.target.z * 0.7 : 0);
            rH.target.z = (rS.valid ? rS.target.z * 0.7 : 0);
        }

        const calcLimbDepth = (parentIdx, childIdx, idealLen, forwardSign = 1) => {
            const parent = skp[parentIdx];
            const child = skp[childIdx];
            if (parent.valid && child.valid) {
                const dx = child.target.x - parent.target.x;
                const dy = child.target.y - parent.target.y;
                const d2d = Math.sqrt(dx * dx + dy * dy);
                if (d2d < idealLen) {
                    const dz = Math.sqrt(Math.max(0, idealLen * idealLen - d2d * d2d));
                    child.target.z = parent.target.z + forwardSign * dz * 0.65;
                } else {
                    child.target.z = parent.target.z;
                }
            }
        };

        const isLegExercise = ['squat', 'lunge', 'jumping_jack', 'glute_bridge', 'calf_raise'].some(ex => exercise.includes(ex));
        const legDepthDir = isLegExercise ? 1 : 0.5;

        calcLimbDepth(this.KP.LEFT_HIP, this.KP.LEFT_KNEE, 0.44, legDepthDir);
        calcLimbDepth(this.KP.LEFT_KNEE, this.KP.LEFT_ANKLE, 0.42, 0);
        calcLimbDepth(this.KP.RIGHT_HIP, this.KP.RIGHT_KNEE, 0.44, legDepthDir);
        calcLimbDepth(this.KP.RIGHT_KNEE, this.KP.RIGHT_ANKLE, 0.42, 0);

        const isArmExercise = ['pushup', 'bicep_curl', 'shoulder_press', 'plank'].some(ex => exercise.includes(ex));
        const armDepthDir = isArmExercise ? -0.8 : 0.3;

        calcLimbDepth(this.KP.LEFT_SHOULDER, this.KP.LEFT_ELBOW, 0.32, armDepthDir);
        calcLimbDepth(this.KP.LEFT_ELBOW, this.KP.LEFT_WRIST, 0.28, armDepthDir);
        calcLimbDepth(this.KP.RIGHT_SHOULDER, this.KP.RIGHT_ELBOW, 0.32, armDepthDir);
        calcLimbDepth(this.KP.RIGHT_ELBOW, this.KP.RIGHT_WRIST, 0.28, armDepthDir);

        const alpha = this.isLiveStream ? this.smoothingAlpha : 1.0;
        for (let i = 0; i < 17; i++) {
            const sk = this.smoothedKeypoints[i];
            if (sk.valid) {
                sk.pos.x += (sk.target.x - sk.pos.x) * alpha;
                sk.pos.y += (sk.target.y - sk.pos.y) * alpha;
                sk.pos.z += (sk.target.z - sk.pos.z) * alpha;
            }
        }
    }

    updatePose(data, isLive = true) {
        if (!data) return;
        this.currentData = data;
        this.isLiveStream = isLive;

        if (isLive) {
            this.lastPoseData = data;
            if (data.violations && data.violations.length > 0) {
                data.violations.forEach(v => {
                    if (!this.sessionViolations.includes(v)) {
                        this.sessionViolations.push(v);
                    }
                });
                if (!this.worstPoseData || (data.formScore !== undefined && data.formScore < (this.worstPoseData.formScore || 100))) {
                    this.worstPoseData = data;
                }
            }
        }

        if (data.keypoints && data.keypoints.length >= 17) {
            this.map2DTo3D(data.keypoints, data.exercise || window.currentExercise || 'squat');
            this.hideFallbackMessage();
        }

        this.updateHUDOverlay(data);
    }

    // Zero-allocation cylinder aligner
    updateCylinder(mesh, pA, pB) {
        if (!mesh || !pA || !pB) return;
        this.tempDir.subVectors(pB, pA);
        const len = this.tempDir.length();

        if (len < 0.001) {
            mesh.visible = false;
            return;
        }

        mesh.visible = true;
        mesh.scale.set(1, len, 1);
        mesh.position.copy(pA).add(pB).multiplyScalar(0.5);

        this.tempDir.normalize();
        mesh.quaternion.setFromUnitVectors(this.tempAxis, this.tempDir);
    }

    updateHUDOverlay(data) {
        const phaseEl = document.getElementById('bio3dPhaseBadge');
        if (phaseEl) {
            const exName = (data.exercise || window.currentExercise || 'SQUAT').replace(/_/g, ' ').toUpperCase();
            const phaseName = data.phase || (this.isLiveStream ? 'ACTIVE' : 'STANDBY');
            phaseEl.innerText = `${exName} • ${phaseName}`;
        }

        const scoreEl = document.getElementById('bio3dScoreBadge');
        if (scoreEl) {
            const score = data.formScore !== undefined ? Math.round(data.formScore) : 100;
            scoreEl.innerText = `FORM ${score}%`;
            if (data.violations && data.violations.length > 0) {
                scoreEl.style.borderColor = '#FF3366';
                scoreEl.style.color = '#FF3366';
            } else {
                scoreEl.style.borderColor = '#00F5FF';
                scoreEl.style.color = '#00F5FF';
            }
        }

        const metricsEl = document.getElementById('bio3dMetricsBox');
        if (metricsEl && data.angles) {
            let html = '';
            for (const [key, val] of Object.entries(data.angles)) {
                if (typeof val === 'number') {
                    const label = key.replace(/_/g, ' ').toUpperCase();
                    html += `<div class="bio3d-metric-item"><span>${label}:</span> <strong>${Math.round(val)}°</strong></div>`;
                }
            }
            if (data.feedback) {
                html += `<div class="bio3d-feedback-line">${data.feedback}</div>`;
            }
            metricsEl.innerHTML = html || `<div class="bio3d-feedback-line">${data.feedback || 'Live 3D Pose Active'}</div>`;
        }
    }

    renderFrame(customViolationsText = null) {
        const ex = (this.currentData && this.currentData.exercise) || window.currentExercise || 'squat';
        const activeJoints = this.activeJointsPerExercise[ex] || [11, 12, 13, 14];

        const violationsArray = customViolationsText !== null 
            ? [customViolationsText]
            : (this.currentData && this.currentData.violations ? this.currentData.violations : []);
        
        const hasViolations = violationsArray.length > 0;
        const violationsText = hasViolations ? violationsArray.join(' ').toLowerCase() : '';

        // 17 Joint Meshes Color & Material Update
        for (let i = 0; i < 17; i++) {
            const mesh = this.jointMeshes[i];
            const sk = this.smoothedKeypoints[i];

            if (mesh && sk) {
                if (sk.valid && sk.conf >= 0.2) {
                    mesh.position.copy(sk.pos);
                    mesh.visible = true;

                    // Form violation joint decision
                    let isViolationJoint = false;
                    if (hasViolations) {
                        if ((i === 13 || i === 14) && (violationsText.includes('knee') || violationsText.includes('depth') || violationsText.includes('shallow'))) {
                            isViolationJoint = true;
                        } else if ((i === 7 || i === 8) && (violationsText.includes('elbow') || violationsText.includes('arm'))) {
                            isViolationJoint = true;
                        } else if ((i === 11 || i === 12 || i === 5 || i === 6) && (violationsText.includes('torso') || violationsText.includes('sag') || violationsText.includes('lean') || violationsText.includes('back'))) {
                            isViolationJoint = true;
                        }
                    }

                    if (isViolationJoint) {
                        mesh.material = this.materials.jointWarning; // Red #FF3366
                    } else if (activeJoints.includes(i)) {
                        mesh.material = this.materials.jointActive;  // Yellow #F5FF00
                    } else {
                        mesh.material = this.materials.jointNormal;  // Cyan #00F5FF
                    }
                } else {
                    mesh.visible = false;
                }
            }
        }

        // Bone Cylinder Meshes Update
        for (let i = 0; i < this.boneConnections.length; i++) {
            const [idxA, idxB, category] = this.boneConnections[i];
            const boneMesh = this.boneMeshes[i];
            const skA = this.smoothedKeypoints[idxA];
            const skB = this.smoothedKeypoints[idxB];

            if (boneMesh && skA && skB && skA.valid && skB.valid) {
                this.updateCylinder(boneMesh, skA.pos, skB.pos);

                let isViolationBone = false;
                if (hasViolations) {
                    if (category === 'leg' && (violationsText.includes('knee') || violationsText.includes('depth') || violationsText.includes('shallow'))) {
                        isViolationBone = true;
                    } else if (category === 'arm' && (violationsText.includes('elbow') || violationsText.includes('arm'))) {
                        isViolationBone = true;
                    } else if (category === 'torso' && (violationsText.includes('torso') || violationsText.includes('sag') || violationsText.includes('lean') || violationsText.includes('back'))) {
                        isViolationBone = true;
                    }
                }

                boneMesh.material = isViolationBone ? this.materials.boneWarning : this.materials.boneNormal;
            } else if (boneMesh) {
                boneMesh.visible = false;
            }
        }

        // Spine Cylinder Update
        const skLS = this.smoothedKeypoints[this.KP.LEFT_SHOULDER];
        const skRS = this.smoothedKeypoints[this.KP.RIGHT_SHOULDER];
        const skLH = this.smoothedKeypoints[this.KP.LEFT_HIP];
        const skRH = this.smoothedKeypoints[this.KP.RIGHT_HIP];

        if (skLS.valid && skRS.valid && skLH.valid && skRH.valid) {
            this.midShoulder.addVectors(skLS.pos, skRS.pos).multiplyScalar(0.5);
            this.midHip.addVectors(skLH.pos, skRH.pos).multiplyScalar(0.5);
            this.updateCylinder(this.spineMesh, this.midShoulder, this.midHip);

            const isTorsoViolation = hasViolations && (violationsText.includes('torso') || violationsText.includes('sag') || violationsText.includes('lean') || violationsText.includes('back'));
            this.spineMesh.material = isTorsoViolation ? this.materials.boneWarning : this.materials.spineNormal;
        } else if (this.spineMesh) {
            this.spineMesh.visible = false;
        }

        // Neck Cylinder Update
        const skNose = this.smoothedKeypoints[this.KP.NOSE];
        if (skLS.valid && skRS.valid && skNose.valid) {
            this.midShoulder.addVectors(skLS.pos, skRS.pos).multiplyScalar(0.5);
            this.updateCylinder(this.neckMesh, this.midShoulder, skNose.pos);
        } else if (this.neckMesh) {
            this.neckMesh.visible = false;
        }

        // Render Scene
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    animate() {
        if (!this.initialized || this.isCollapsed || !this.isTabVisible) {
            this.animationFrameId = null;
            return;
        }

        this.animationFrameId = requestAnimationFrame(() => this.animate());

        if (this.controls) this.controls.update();

        this.renderFrame();
    }

    renderSessionAnalysis(sessionData) {
        this.stopAnimationLoop();

        if (!sessionData) return;

        // 1. Phase badge: "SQUAT • SESSION COMPLETE"
        const phaseEl = document.getElementById('bio3dPhaseBadge');
        if (phaseEl) {
            const exName = (sessionData.exercise || window.currentExercise || 'SQUAT').replace(/_/g, ' ').toUpperCase();
            phaseEl.innerText = `${exName} • SESSION COMPLETE`;
        }

        // 2. Score badge: final average form score from sessionData.accuracy
        const scoreEl = document.getElementById('bio3dScoreBadge');
        const finalScore = sessionData.accuracy !== undefined ? Math.round(sessionData.accuracy) : 100;
        if (scoreEl) {
            scoreEl.innerText = `FORM ${finalScore}%`;
            if (finalScore < 90 || (this.sessionViolations && this.sessionViolations.length > 0)) {
                scoreEl.style.borderColor = '#FF3366';
                scoreEl.style.color = '#FF3366';
            } else {
                scoreEl.style.borderColor = '#00F5FF';
                scoreEl.style.color = '#00F5FF';
            }
        }

        // 3. Metrics box: 1-2 line summary generated from logged session data
        const metricsEl = document.getElementById('bio3dMetricsBox');
        if (metricsEl) {
            const totalReps = sessionData.reps || 0;
            const feedbackList = sessionData.feedbackLog || window.sessionFeedbackLog || [];
            const allViolations = [...(this.sessionViolations || []), ...feedbackList];
            const lowerViolations = allViolations.join(' ').toLowerCase();

            let violationNotes = [];
            if (lowerViolations.includes('knee') || lowerViolations.includes('depth') || lowerViolations.includes('shallow')) {
                violationNotes.push('knee angle flagged');
            }
            if (lowerViolations.includes('elbow') || lowerViolations.includes('arm')) {
                violationNotes.push('elbow posture flagged');
            }
            if (lowerViolations.includes('torso') || lowerViolations.includes('sag') || lowerViolations.includes('lean') || lowerViolations.includes('back')) {
                violationNotes.push('torso position flagged');
            }

            let summaryText = '';
            if (totalReps > 0) {
                if (violationNotes.length > 0) {
                    summaryText = `${totalReps} reps completed — ${violationNotes.join(', ')}, avg form ${finalScore}%.`;
                } else {
                    summaryText = `${totalReps} reps completed — optimal form maintained across all sets, avg form ${finalScore}%.`;
                }
            } else {
                summaryText = `Session ended — avg form ${finalScore}%.`;
            }

            metricsEl.innerHTML = `<div class="bio3d-feedback-line" style="color: #e5e2e1; font-weight: 600;">${summaryText}</div>`;
        }

        // 4. Set static pose (lowest form score frame preferred, fallback to last frame)
        const targetFrame = this.worstPoseData || this.lastPoseData;
        if (targetFrame && targetFrame.keypoints && targetFrame.keypoints.length >= 17) {
            this.isLiveStream = false;
            this.map2DTo3D(targetFrame.keypoints, sessionData.exercise || window.currentExercise || 'squat');
            this.hideFallbackMessage();
        }

        // 5. Render static frame once with joint violation red highlighting (#FF3366)
        const allViolationsText = [...(this.sessionViolations || []), ...(sessionData.feedbackLog || [])].join(' ').toLowerCase();
        this.renderFrame(allViolationsText);
    }

    dispose() {
        this.stopAnimationLoop();

        if (this.visibilityHandler) {
            document.removeEventListener('visibilitychange', this.visibilityHandler);
        }
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }

        if (this.renderer) {
            this.renderer.dispose();
        }
        for (const mat of Object.values(this.materials)) {
            if (mat && mat.dispose) mat.dispose();
        }
    }
}

// Global initialization & DOM event binding
window.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('biomechanics3DCanvasContainer')) {
        window.biomechanicalSkeleton3D = new BiomechanicalSkeleton3D('biomechanics3DCanvasContainer', 'biomechanics3DCanvas');
    }

    const collapseBtn = document.getElementById('toggle3DCollapseBtn');
    const bodyEl = document.getElementById('biomechanics3DBody');
    const iconEl = document.getElementById('collapse3DIcon');

    if (collapseBtn && bodyEl && iconEl) {
        collapseBtn.addEventListener('click', () => {
            const isHidden = bodyEl.style.display === 'none';
            bodyEl.style.display = isHidden ? 'block' : 'none';
            iconEl.innerText = isHidden ? 'expand_less' : 'expand_more';

            if (window.biomechanicalSkeleton3D) {
                window.biomechanicalSkeleton3D.setCollapsed(!isHidden);
            }
        });
    }
});
