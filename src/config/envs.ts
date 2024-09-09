import 'dotenv/config';
import * as joi from 'joi';

// Interfaz para las configuraciones de los microservicios
interface MicroserviceConfig {
    PORT: number;
    HOST: string;
}

interface EnvVars {
    PORT: number;
    PRODUCTS_MICROSERVICE: MicroserviceConfig;
}

// Schema de validación de las variables de entorno usando Joi
const microserviceSchema = joi.object({
    PORT: joi.number().required(),
    HOST: joi.string().required(),
});

const envsSchema = joi.object({
    PORT: joi.number().required(),
    PRODUCTS_MICROSERVICE: microserviceSchema.required(),
}).unknown(true);

// Validación de las variables de entorno
const { error, value } = envsSchema.validate({
    PORT: process.env.PORT,
    PRODUCTS_MICROSERVICE: {
        PORT: process.env.PRODUCT_MICROSERVICE_PORT,
        HOST: process.env.PRODUCT_MICROSERVICE_HOST,
    },
});

if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}

const envVars: EnvVars = value;

// Exportación de las variables de entorno ya validadas y organizadas
export const envs = {
    port: envVars.PORT,
    productsMicroservice: {
        host: envVars.PRODUCTS_MICROSERVICE.HOST,
        port: envVars.PRODUCTS_MICROSERVICE.PORT,
    },
};
