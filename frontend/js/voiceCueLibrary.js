/**
 * FitVision Bilingual Voice Cue Library (js/voiceCueLibrary.js)
 * Natural Hinglish & English audio cues for 10 exercises & generic system events.
 */

window.VOICE_CUES = {
    squat: {
        achievement: {
            en: [
                "Great depth! Now drive up strong through your heels!",
                "Perfect squat depth! Explode back up!",
                "Solid depth! Push through the floor!"
            ],
            hi: [
                "Ekdam mast depth! Ab poora force lagake upar aao!",
                "Perfect squat depth! Heels se push karke drive karo!",
                "Shaandar depth! Core tight rakho aur upar aao!"
            ]
        },
        effort: {
            en: [
                "Control your descent, keep your chest high.",
                "Stay balanced, lower down smooth."
            ],
            hi: [
                "Descent control rakho, chest up rakho.",
                "Balance banaye rakho, smooth neeche aao."
            ]
        }
    },

    pushup: {
        achievement: {
            en: [
                "Chest to floor! Now push up strong!",
                "Great depth! Drive through your palms!",
                "Solid pushup depth! Keep body straight!"
            ],
            hi: [
                "Ekdam badiya push! Ab palms se drive karo!",
                "Full chest range! Body line straight rakho!",
                "Shaandar pushup! Strong lockout karo!"
            ]
        },
        effort: {
            en: [
                "Lower down controlled, elbows 45 degrees.",
                "Keep core tight as you lower."
            ],
            hi: [
                "Controlled way me neeche aao.",
                "Core tight rakho, elbows tucked rakho."
            ]
        }
    },

    lunge: {
        achievement: {
            en: [
                "Great lunge depth! Push back through front heel!",
                "Perfect 90-degree bend! Drive up!"
            ],
            hi: [
                "Mast lunge depth! Front heel se push karo!",
                "Perfect knee bend! Balance ke sath upar aao!"
            ]
        },
        effort: {
            en: [
                "Step firm and lower with control.",
                "Keep your torso upright."
            ],
            hi: [
                "Torso straight rakho aur neeche aao.",
                "Firm step lo, balance maintain karo."
            ]
        }
    },

    glute_bridge: {
        achievement: {
            en: [
                "Peak hip extension! Squeeze your glutes!",
                "Strong hip lockout! Hold at top!"
            ],
            hi: [
                "Full hip rise! Glutes ko tight squeeze karo!",
                "Badiya bridge! Top par hold karo!"
            ]
        },
        effort: {
            en: [
                "Lower hips smoothly.",
                "Keep knees stable as you lower."
            ],
            hi: [
                "Hips ko smoothly down lao.",
                "Knees stable rakho."
            ]
        }
    },

    plank: {
        achievement: {
            en: [
                "Solid plank hold! Breathe through your core!",
                "Perfect body line! Stay strong!"
            ],
            hi: [
                "Solid hold! Core engaged rakho!",
                "Badiya plank form! Hold it strong!"
            ]
        },
        effort: {
            en: [
                "Keep holding, don't drop your hips.",
                "Maintain straight body alignment."
            ],
            hi: [
                "Hold banaye rakho, hips sag mat hone do.",
                "Straight line maintain karo."
            ]
        }
    },

    bicep_curl: {
        achievement: {
            en: [
                "Full contraction! Squeeze the bicep!",
                "Great curl! Peak squeeze at the top!"
            ],
            hi: [
                "Full bicep squeeze! Top par hold karo!",
                "Badiya curl! Arm control me rakho!"
            ]
        },
        effort: {
            en: [
                "Lower slow for full stretch.",
                "Keep elbows pinned to your sides."
            ],
            hi: [
                "Slow stretch ke sath neeche lao.",
                "Elbows pinned rakho."
            ]
        }
    },

    shoulder_press: {
        achievement: {
            en: [
                "Full overhead extension! Press strong!",
                "Great lockout! Drive to the top!"
            ],
            hi: [
                "Full overhead lockout! Shaandar press!",
                "Solid extension! Control me lao!"
            ]
        },
        effort: {
            en: [
                "Lower dumbbells to shoulder level with control.",
                "Keep core tight, don't arch lower back."
            ],
            hi: [
                "Shoulder height tak smoothly down lao.",
                "Back arch mat hone do."
            ]
        }
    },

    mountain_climber: {
        achievement: {
            en: [
                "High speed knee drive! Keep pushing!",
                "Great pace! Keep your hips low!"
            ],
            hi: [
                "Fast knee drive! Speed maintain karo!",
                "Mast pace! Hips low rakho!"
            ]
        },
        effort: {
            en: [
                "Drive those knees fast!",
                "Stay light on your toes."
            ],
            hi: [
                "Knees fast drive karo!",
                "Toes par light rehkar speed lao."
            ]
        }
    },

    jumping_jack: {
        achievement: {
            en: [
                "Full extension! Great rhythm!",
                "Big jump, overhead touch!"
            ],
            hi: [
                "Shaandar jump! Full reach karo!",
                "Ekdam badiya rhythm!"
            ]
        },
        effort: {
            en: [
                "Keep up the tempo!",
                "Land softly on toes."
            ],
            hi: [
                "Tempo maintain rakho!",
                "Toes par soft landing karo."
            ]
        }
    },

    calf_raise: {
        achievement: {
            en: [
                "High heel rise! Squeeze those calves!",
                "Peak elevation! Hold at the top!"
            ],
            hi: [
                "Full heel rise! Calves squeeze karo!",
                "Badiya elevation! Top par hold karo!"
            ]
        },
        effort: {
            en: [
                "Lower heels slowly.",
                "Control the descent."
            ],
            hi: [
                "Heels slow down lao.",
                "Descent control rakho."
            ]
        }
    }
};

window.GENERIC_CUES = {
    milestone: {
        en: [
            "Halfway there! Keep powering through!",
            "5 reps completed! Excellent form!",
            "10 reps done! You're crushing this set!"
        ],
        hi: [
            "Aadha set complete! Energy banaye rakho!",
            "5 reps poore ho gaye! Badiya technique!",
            "10 reps done! Kafi strong ja rahe ho!"
        ]
    },
    repeated_mistake: {
        en: [
            "Form correction alert: Watch your {violation_description}. Let's focus on proper technique.",
            "Noticeable pattern: Repeated {violation_description}. Take a breath and reset your alignment."
        ],
        hi: [
            "Form alert: Apne {violation_description} par dhyan do. Baseline form reset karte hain.",
            "Technique alert: Repeated {violation_description} ho raha hai. Proper form ke sath continue karo."
        ]
    },
    target_adjustment: {
        en: [
            "Suggested target adjustment: Based on your recent average, {suggested_target} reps might give you better form quality than {target}.",
            "Smart target advice: Pushing to {target} is ambitious! Your 5-session average is closer to {suggested_target} reps."
        ],
        hi: [
            "Target advice: Aapke pichle sessions ke hisab se, {suggested_target} reps aapki form quality ke liye better rahenga (instead of {target}).",
            "Smart suggestion: {target} reps ambitious hai! Aapka 5-session average {suggested_target} reps hai."
        ]
    }
};
