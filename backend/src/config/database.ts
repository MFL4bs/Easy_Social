import { DataSource } from 'typeorm';
import { entities } from '../models';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: process.env.NODE_ENV === 'production'
    ? '/app/data/easysocial.db'
    : path.join(__dirname, '..', '..', 'easysocial.db'),
  synchronize: true,
  logging: process.env.NODE_ENV === 'development',
  entities,
  migrations: [],
  subscribers: [],
});

export async function initializeDatabase(): Promise<void> {
  try {
    await AppDataSource.initialize();
    console.log('Database connection established successfully');
  } catch (error) {
    console.error('Error connecting to database:', error);
    throw error;
  }
}