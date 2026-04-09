/**
 * Database Setup Script
 * Creates tables and inserts reference data (banks, categories)
 * @version 2.0.0
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = './financas.db';

console.log('');
console.log('╔════════════════════════════════════════════╗');
console.log('║   Finanças Pessoais - Setup Script v2.0     ║');
console.log('╚════════════════════════════════════════════╝');
console.log('');

// Delete existing database for clean setup
if (fs.existsSync(DB_PATH)) {
    console.log('🗑️  Removendo banco existente...');
    try {
        fs.unlinkSync(DB_PATH);
    } catch (e) {
        console.log('⚠️  Banco em uso, continuando com banco existente...');
    }
}

// Create new database
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Erro ao criar o banco:', err.message);
        process.exit(1);
    }
    console.log('✅ Banco de dados criado: financas.db');
});

// Read SQL files
const schemaPath = path.join(__dirname, 'schema.sql');
const queriesPath = path.join(__dirname, 'queries.sql');

if (!fs.existsSync(schemaPath)) {
    console.error('❌ Arquivo schema.sql não encontrado!');
    process.exit(1);
}

if (!fs.existsSync(queriesPath)) {
    console.error('❌ Arquivo queries.sql não encontrado!');
    process.exit(1);
}

const schemaSql = fs.readFileSync(schemaPath, 'utf8');
const queriesSql = fs.readFileSync(queriesPath, 'utf8');

// Execute schema
db.exec(schemaSql, (err) => {
    if (err) {
        console.error('❌ Erro no Schema:', err.message);
        db.close();
        process.exit(1);
    }
    console.log('✅ Tabelas criadas com sucesso');

    // Execute seed data (banks and categories only)
    db.exec(queriesSql, (err) => {
        if (err) {
            console.error('❌ Erro nas Queries:', err.message);
            db.close();
            process.exit(1);
        }
        console.log('✅ Dados de referência inseridos');
        console.log('');
        console.log('═══════════════════════════════════════════');
        console.log('🎉 Setup concluído com sucesso!');
        console.log('');
        console.log('Bancos disponíveis: 15 instituições');
        console.log('Categorias: Despesas, Receitas e Transferência');
        console.log('');
        console.log('Para iniciar o servidor:');
        console.log('    npm start');
        console.log('');
        console.log('Acesse: http://localhost:3000');
        console.log('═══════════════════════════════════════════');

        db.close();
    });
});