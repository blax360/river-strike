// RIVER STRIKE — AKUMU GAMES
// Shell nativa de Tauri v2: abre el juego y guarda el progreso en disco.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use tauri::Manager;

fn save_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("no se pudo resolver app_config_dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("no se pudo crear {dir:?}: {e}"))?;
    Ok(dir.join("save.json"))
}

#[tauri::command]
fn load_save(app: tauri::AppHandle) -> Result<String, String> {
    let path = save_path(&app)?;
    if !path.exists() {
        return Ok(String::new());
    }
    fs::read_to_string(&path).map_err(|e| format!("no se pudo leer {path:?}: {e}"))
}

#[tauri::command]
fn save_data(app: tauri::AppHandle, json: String) -> Result<(), String> {
    // validación mínima: debe ser un objeto JSON
    if !json.trim_start().starts_with('{') {
        return Err("payload inválido".into());
    }
    let path = save_path(&app)?;
    fs::write(&path, json).map_err(|e| format!("no se pudo escribir {path:?}: {e}"))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_save, save_data])
        .run(tauri::generate_context!())
        .expect("error al iniciar RIVER STRIKE");
}
