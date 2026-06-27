use serde::{Deserialize, Serialize};
use tauri::Manager;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

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
            temperature_max: 1.0,
            max_output_tokens: 512,
        }
    }
}

impl ClippyConfig {
    pub fn load(path: &PathBuf) -> Self {
        if path.exists() {
            match std::fs::read_to_string(path) {
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
        config.save(path);
        config
    }

    pub fn save(&self, path: &PathBuf) {
        if let Some(parent) = path.parent() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                tracing::error!("Failed to create config directory: {}", e);
                return;
            }
        }

        if let Ok(contents) = serde_json::to_string_pretty(self) {
            if let Err(e) = std::fs::write(path, contents) {
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
    app: tauri::AppHandle,
    config: ClippyConfig,
) -> Result<(), String> {
    let config_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("config.json");

    let mut state_config = state.lock().map_err(|e| e.to_string())?;
    *state_config = config;
    state_config.save(&config_path);
    tracing::info!("Config updated: {:?}", state_config);
    Ok(())
}
