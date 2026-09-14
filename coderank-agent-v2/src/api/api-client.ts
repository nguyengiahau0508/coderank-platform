import axios from 'axios';

const INTERNAL_API_URL = process.env.NESTJS_API_URL || 'http://localhost:3000/api';

export const createInternalClient = (userToken: string) => {
  return axios.create({
    baseURL: INTERNAL_API_URL,
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json',
    },
  });
};
