/**
 * Database Reset Script
 * Drops all tables and recreates the database
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = './financas.db';

console.log('🔄 Reiniciando banco de dados...');

// Open existing database
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Erro:', err.message);
        process.exit(1);
    }
});

// Get all tables and drop them
db.all("SELECT name FROM sqlite_master WHERE type='table'", async (err, tables) => {
    if (err) {
        console.error('❌ Erro ao listar tabelas:', err.message);
        db.close();
        process.exit(1);
    }

    console.log('📋 Tabelas encontradas:', tables.map(t => t.name).join(', '));

    // Drop all tables
    const dropPromises = tables
        .filter(t => t.name !== 'sqlite_sequence')
        .map(t => new Promise((resolve, reject) => {
            db.run(`DROP TABLE IF EXISTS ${t.name}`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        }));

    try {
        await Promise.all(dropPromises);
        console.log('✅ Todas as tabelas removidas');

        // Close and recreate
        db.close(async () => {
            console.log('📦 Conexão fechada');

            // Now run the setup
            require('./setup.js');
        });
    } catch (error) {
        console.error('❌ Erro ao remover tabelas:', error.message);
        db.close();
        process.exit(1);
    }
});