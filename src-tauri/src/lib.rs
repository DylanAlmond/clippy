use base64::{engine::general_purpose, Engine as _};
use image::ImageFormat;
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use xcap::Monitor;

#[derive(Serialize, Deserialize, Clone)]
struct ClippyAction {
    text: String,
    animation: String,
}

#[tauri::command]
async fn get_clippy_reaction(animations: Vec<String>) -> Result<ClippyAction, String> {
    // 1. Capture the screen
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let main_monitor = monitors.first().ok_or("No monitor found")?;
    let image = main_monitor.capture_image().map_err(|e| e.to_string())?;

    // 2. Convert image to base64 data URL
    let mut buffer = Vec::new();
    image
        .write_to(&mut Cursor::new(&mut buffer), ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    let b64_image = general_purpose::STANDARD.encode(&buffer);
    let data_url = format!("data:image/png;base64,{}", b64_image);

    // 3. Create the system prompt with the animations list
    let anim_list = animations.join(", ");
    let system_prompt = format!(
        "You are Clippy the paperclip. You are looking at the user's screen. \
        Respond with a sarcastic, helpful, or slightly annoying Clippy remark about what you see. \
        You MUST respond in strict JSON format: {{\"text\": \"your remark\", \"animation\": \"AnimationName\"}}. \
        The 'animation' field MUST be one of the following valid animations: [{}]. \
        Do not output any other text, explanations, or markdown formatting. Only output the JSON object.",
        anim_list
    );

    // 4. Prepare LM Studio Request
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
        "temperature": 0.5,
        "max_output_tokens": 512
    });

    // 5. Send request to local LM Studio server
    let client = reqwest::Client::new();
    let response = client
        .post(url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Is LM Studio running? Error: {}", e))?;

    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

    // 6. Parse LM Studio response (which returns an array of output items)
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
        return Err("No message content found in LM Studio response".into());
    }

    // 7. Clean up the response (Gemma might wrap JSON in ```json ... ``` despite instructions)
    let json_str = extract_json(content_str)?;
    let action: ClippyAction = serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse JSON: {} - Raw: {}", e, content_str))?;

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
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_clippy_reaction])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
