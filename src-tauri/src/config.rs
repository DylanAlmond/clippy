use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ClippyConfig {
    pub model: String,
    pub api_url: String,
    pub temperature_min: f32,
    pub temperature_max: f32,
    pub max_output_tokens: u32,
}

impl Default for ClippyConfig {
    fn default() -> Self {
        Self {
            model: "google/gemma-4-e4b".to_string(),
            api_url: "http://localhost:1234/api/v1/chat".to_string(),
            temperature_min: 0.3,
            temperature_max: 0.7,
            max_output_tokens: 512,
        }
    }
}

impl ClippyConfig {
    pub fn config_path() -> std::path::PathBuf {
        std::path::PathBuf::from("clippy-config.json")
    }

    pub fn load() -> Self {
        let path = Self::config_path();

        if path.exists() {
            match std::fs::read_to_string(&path) {
                Ok(contents) => match serde_json::from_str(&contents) {
                    Ok(config) => {
                        tracing::info!("Loaded config from {:?}", path);
                        return config;
                    }
                    Err(e) => tracing::warn!("Failed to parse config: {}", e),
                },
                Err(e) => tracing::warn!("Failed to read config file: {}", e),
            }
        }

        tracing::info!("Using default config");
        
        let config = Self::default();
        config.save();
        config
    }

    pub fn save(&self) {
        let path = Self::config_path();

        if let Ok(contents) = serde_json::to_string_pretty(self) {
            if let Err(e) = std::fs::write(&path, contents) {
                tracing::error!("Failed to save config: {}", e);
            } else {
                tracing::info!("Saved config to {:?}", path);
            }
        }
    }
}

#[tauri::command]
pub fn get_config(state: tauri::State<'_, Arc<Mutex<ClippyConfig>>>) -> ClippyConfig {
    state.lock().unwrap().clone()
}

#[tauri::command]
pub fn update_config(
    state: tauri::State<'_, Arc<Mutex<ClippyConfig>>>,
    config: ClippyConfig,
) -> Result<(), String> {
    let mut state_config = state.lock().map_err(|e| e.to_string())?;
    *state_config = config;
    state_config.save();
    tracing::info!("Config updated: {:?}", state_config);
    Ok(())
}
