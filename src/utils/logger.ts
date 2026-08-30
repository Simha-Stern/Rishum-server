import winston from 'winston';

const isProduction = process.env['NODE_ENV'] === 'production';

const developmentFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack, ...metadata }) => {
    const details = Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : '';
    return `${timestamp} ${level}: ${message}${details}${stack ? `\n${stack}` : ''}`;
  }),
);

const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

export const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] ?? (isProduction ? 'info' : 'debug'),
  format: isProduction ? productionFormat : developmentFormat,
  transports: [new winston.transports.Console()],
});
