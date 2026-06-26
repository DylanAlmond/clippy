use base64::{engine::general_purpose, Engine as _};
use image::ImageFormat;
use rand::random_range;
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use tracing_subscriber::{fmt, prelude::*};
use xcap::Monitor;

#[derive(Serialize, Deserialize, Clone)]
struct ClippyAction {
    text: String,
    animation: String,
}

#[tauri::command]
async fn get_clippy_reaction(animations: Vec<String>) -> Result<ClippyAction, String> {
    // Capture the screen
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let main_monitor = monitors.first().ok_or("No monitor found")?;
    let image = main_monitor.capture_image().map_err(|e| e.to_string())?;

    // Convert image to base64 data URL
    let mut buffer = Vec::new();
    image
        .write_to(&mut Cursor::new(&mut buffer), ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    let b64_image = general_purpose::STANDARD.encode(&buffer);
    let data_url = format!("data:image/png;base64,{}", b64_image);

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

    // Prepare LM Studio Request
    let url = "http://localhost:1234/api/v1/chat";
    let payload = serde_json::json!({
        "model": "google/gemma-4-e4b",
        "system_prompt": system_prompt,
        "input": [
            {
                "type": "text",
                "content": "What do you think of what I'm doing right now?"
            },
            {
                "type": "image",
                "data_url": data_url
            }
        ],
        "temperature": temperature,
        "max_output_tokens": 512
    });

    // Create clone for log minus large screenshot
    let mut log_payload = payload.clone();
    if let Some(input) = log_payload["input"].as_array_mut() {
        for item in input {
            if item["type"] == "image" {
                item["data_url"] = serde_json::Value::String("<base64 image omitted>".to_string());
            }
        }
    }

    // Log request
    tracing::info!(
        "LLM Request:\n{}",
        serde_json::to_string_pretty(&log_payload).unwrap()
    );

    // Send request to local LM Studio server
    let client = reqwest::Client::new();
    let response = client
        .post(url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Is LM Studio running? Error: {}", e))?;

    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

    // Log response
    tracing::info!(
        "LLM Response:\n{}",
        serde_json::to_string_pretty(&data).unwrap()
    );

    // Parse LM Studio response (which returns an array of output items)
    let output_array = data["output"]
        .as_array()
        .ok_or("Invalid LM Studio response: missing output array")?;

    let mut content_str = "";
    for item in output_array {
        if item["type"].as_str() == Some("message") {
            if let Some(content) = item["content"].as_str() {
                content_str = content;
                break;
            }
        }
    }

    if content_str.is_empty() {
        // Log error
        tracing::error!("No message content found. Response: {}", data);
        return Err("No message content found in LM Studio response".into());
    }

    // Clean up the response (Gemma might wrap JSON in ```json ... ``` despite instructions)
    let json_str = extract_json(content_str)?;
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

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_clippy_reaction])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
