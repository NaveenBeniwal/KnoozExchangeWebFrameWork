import { APIRequestContext } from "@playwright/test";

export class ApiHelper {

    private readonly request: APIRequestContext;
    private readonly baseURL: string;

    constructor(request: APIRequestContext, baseURL: string) {
        this.request = request;
        this.baseURL = baseURL;
    }


    private async parseBody(response: Awaited<ReturnType<typeof this.request.get>>) {
        const text = await response.text();
        if (!text) return null;
        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }

    async get(endPoint: string, headers?: Record<string, string>) {
        const response = await this.request.get(`${this.baseURL}${endPoint}`, { headers });
        return {
            status: response.status(),
            body: await this.parseBody(response),
        };
    }

    async post(endPoint: string, data: object, headers?: Record<string, string>) {
        const response = await this.request.post(`${this.baseURL}${endPoint}`, { data, headers });
        return {
            status: response.status(),
            body: await this.parseBody(response),
        };
    }

    async put(endPoint: string, data: object, headers?: Record<string, string>) {
        const response = await this.request.put(`${this.baseURL}${endPoint}`, { data, headers });
        return {
            status: response.status(),
            body: await this.parseBody(response),
        };
    }

    async delete(endPoint: string, headers?: Record<string, string>) {
        const response = await this.request.delete(`${this.baseURL}${endPoint}`, { headers });
        return {
            status: response.status(),
            body: await this.parseBody(response),
        };
    }

}