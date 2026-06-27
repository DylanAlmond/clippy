use mistralrs::{
    IsqBits, Model, ModelBuilder, MultimodalMessages, RequestBuilder, SamplingParams,
    TextMessageRole,
};
use rand::random_range;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use tracing_subscriber::{fmt, prelude::*};
use xcap::Monitor;

struct AppState {
    model: std::sync::Arc<Model>,
}

#[derive(Serialize, Deserialize, Clone)]
struct ClippyAction {
    text: String,
    animation: String,
}

const MODEL_ID: &str = "google/gemma-4-E4B-it";

#[tauri::command]
async fn get_clippy_reaction(
    state: State<'_, AppState>,
    animations: Vec<String>,
) -> Result<ClippyAction, String> {
    // Capture the screen
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let main_monitor = monitors.first().ok_or("No monitor found")?;
    let image_buffer = main_monitor.capture_image().map_err(|e| e.to_string())?;

    let image = image::load_from_memory(&image_buffer).map_err(|e| e.to_string())?;

    // Create the system prompt with the animations list
    let anim_list = animations.join(", ");
    let system_prompt = format!(
        "You are Clippy the paperclip. You are looking at the user's screen. \
        Respond with a sarcastic, helpful, or slightly annoying Clippy remark about what you see. \
        You MUST respond in strict JSON format: {{\"text\": \"your remark\", \"animation\": \"AnimationName\"}}. \
        The 'animation' field MUST be one of the following valid animations: [{}]. \
        Do not output any other text, explanations, or markdown formatting. Only output the JSON object.",
        anim_list
    );

    let temperature = random_range(0.3..0.7);

    let sampling = SamplingParams {
        temperature: Some(temperature),
        max_len: Some(512),
        ..SamplingParams::neutral()
    };

    let messages = MultimodalMessages::new()
        .add_message(TextMessageRole::System, system_prompt)
        .add_image_message(
            TextMessageRole::User,
            "What do you think of what I'm doing right now?",
            vec![image],
        );

    // Log request
    tracing::info!("Sending request to mistral.rs model...");

    let request = RequestBuilder::from(messages).set_sampling(sampling);

    let response = state
        .model
        .send_chat_request(request)
        .await
        .map_err(|e| e.to_string())?;

    let content_str = response
        .choices
        .first()
        .and_then(|c| c.message.content.clone())
        .ok_or("No content in model response")?;

    // Log response
    tracing::info!("LLM Response:\n{}", content_str);

    // Clean up the response (Gemma might wrap JSON in ```json ... ``` despite instructions)
    let json_str = extract_json(&content_str)?;
    let action: ClippyAction = serde_json::from_str(&json_str).map_err(|e| {
        tracing::error!("JSON parse failed: {}\nRaw response: {}", e, content_str);
        format!("Failed to parse JSON: {} - Raw: {}", e, content_str)
    })?;

    Ok(action)
}

/// Helper to extract JSON object from a string that might contain markdown code blocks
fn extract_json(text: &str) -> Result<String, String> {
    if let Some(start) = text.find('{') {
        if let Some(end) = text.rfind('}') {
            return Ok(text[start..=end].to_string());
        }
    }
    Err(format!("No JSON object found in text: {}", text))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let file_appender = tracing_appender::rolling::daily("logs", "llm.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    tracing_subscriber::registry()
        .with(fmt::layer().with_writer(non_blocking).with_ansi(false))
        .init();

    let model = tauri::async_runtime::block_on(async {
        ModelBuilder::new(MODEL_ID)
            .with_auto_isq(IsqBits::Four)
            .with_logging()
            // Uncomment for LLaVA 1.5:
            // .with_chat_template("chat_templates/vicuna.json")
            .build()
            .await
            .expect("Model load failed!")
    });

    tauri::Builder::default()
        .setup(|app| {
            #[cfg(debug_assertions)] // only include this code on debug builds
            {
                use tauri::Manager;

                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .manage(AppState {
            model: Arc::new(model),
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_clippy_reaction])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
