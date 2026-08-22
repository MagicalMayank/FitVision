import sqlite3
import os

DB_PATH = "kinetic_oracle.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            name TEXT,
            level INTEGER,
            avatar_url TEXT,
            status TEXT
        )
    ''')
    
    # Insert dummy user if not exists
    cursor.execute('SELECT count(*) FROM users WHERE id = 1')
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
            INSERT INTO users (id, name, level, avatar_url, status)
            VALUES (1, 'Alex Rivera', 42, 'https://lh3.googleusercontent.com/aida-public/AB6AXuC9ucD-WmYQaQExqdikk7fuNP1bT_6UYChS09NNqzIie8v-0g7NmsSyJWk3I_OCvCF3pTumkdGU8NHhhIKHKS3VXYdYdm606r6YNPGg1jp60yEVGd2yvCTgJJ1xAaEVfAdHwwy1XDgui_AiDE-OV8gX-kXIEiJnkT1R_XJYvjoTG5AGLn408Ab2A9TLednuUewe2SSTcmW6YBazVjYjomgVURt7TvBzbV1BoOyuwVSH4W1IpI7E7j1mCw3-RgBGAnJJDwn7F5LNd_c', 'Elite Athlete')
        ''')
    
    conn.commit()
    conn.close()

def get_user():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE id = 1')
    user = cursor.fetchone()
    conn.close()
    return dict(user) if user else None
