

import { test, expect } from '../../src/fixtures/apifixtures';

const TOKEN = process.env.API_TOKEN!;
let AUTH_HEADER = { Authorization: `Bearer ${TOKEN}` };

let userId: number;

test.describe.serial('running e2e go rest crud api tests', () => {

    //GET test:
    test('GET API -- get all users', async ({ apiHelper }: { apiHelper: any }) => {
        let response = await apiHelper.get('/public/v2/users', AUTH_HEADER);
        expect(response.status).toBe(200);
        expect(response.body.length).toBeGreaterThan(0);
    });


    test('POST API -- create a user', async ({ apiHelper }: { apiHelper: any }) => {
        let userData = {
            name: 'Naveen API',
            email: `automation_${Date.now()}@open.com`,
            gender: 'male',
            status: 'active'
        };

        let response = await apiHelper.post('/public/v2/users', userData, AUTH_HEADER);
        expect(response.status).toBe(201);
        expect(response.body.name).toBe(userData.name);
        userId = response.body.id;
        console.log('Created User Id: ', userId);
    });


    test('PUT API -- Update a user', async ({ apiHelper }: { apiHelper: any }) => {
        let userUpdatedData = {
            name: 'Naveen API Updated',
            status: 'inactive'
        };

        let response = await apiHelper.put(`/public/v2/users/${userId}`, userUpdatedData, AUTH_HEADER);
        expect(response.status).toBe(200);
        expect(response.body.name).toBe(userUpdatedData.name);
        expect(response.body.status).toBe(userUpdatedData.status);
    });

    test('DELETE API -- Delete a user', async ({ apiHelper }: { apiHelper: any }) => {
        let response = await apiHelper.delete(`/public/v2/users/${userId}`, AUTH_HEADER);
        expect(response.status).toBe(204);
    });

});