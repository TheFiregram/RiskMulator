use tauri_plugin_sql::{Migration, MigrationKind};

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_core_tables",
            sql: include_str!("../migrations/0001_core.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "tablet_photos_and_hazard_workflow",
            sql: include_str!("../migrations/0002_tablet.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "inspection_reports",
            sql: include_str!("../migrations/0003_reports.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:riskmulator.db", migrations())
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running RiskMulator");
}
