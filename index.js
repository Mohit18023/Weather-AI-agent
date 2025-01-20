import OpenAI from "openai";
import dotenv from "dotenv";
import fetch from 'node-fetch';
import readlineSync from "readline-sync";


dotenv.config();
const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

async function getWeatherDetails(city) {
    try {
        const geoResponse = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}`
        );
        const geoData = await geoResponse.json();

        if (!geoData.results || geoData.results.length === 0) {
            return `Unable to find location for "${city}". Please ensure the city name is correct.`;
        }

        const { latitude, longitude } = geoData.results[0];

        const weatherResponse = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
        );
        const weatherData = await weatherResponse.json();

        const temperature = weatherData.current_weather.temperature;
        return `${temperature}°C`;

    } catch (error) {
        console.error("Error fetching weather details:", error);
        return "An error occurred while fetching weather details. Please try again.";
    }
}

const tools = {
    "getWeatherDetails": getWeatherDetails
}


const SYSTEM_PROMPT = `
You are an AI Assistant with START, PLAN, ACTION, OBERSERVATION and OUTPUT State.
Wait for the user promt and first PLAN using available tools.
After Planning, take the action with appropriate tools and wait for Obervation based on Action.
ONCE you get the observations, Return the AI response based on START promt and observation.

Strictly follow the JSON output format as in example.

Available Tools:
- function getWeatherDetails(city: string): string
getWeatherDetails is a function that takes a city as input and returns the weather of that city.

EXAMPLE
START
{ "type" : "user" , "user" : "What is the sum of weather of patiala and maholi" }
{ "type" : "plan" , "plan" : "I will call the getWeatherDetails for Patiala" }
{ "type" : "action" , "function : "getWeatherDetails" , "input" : "patiala" }
{ "type" : "observation" , "observation" : "10°C" }
{ "type" : "plan" , "plan" : "I will call the getWeatherDetails for Maholi" }
{ "type" : "action" , "function : "getWeatherDetails" , "input" : "maholi" }
{ "type" : "observation" , "observation" : "14°C" }
{ "type" : "output" , "output" : "The sum of weather of patiala and maholi is 24°C" }

`;

const messages = [
    { role: "system", content: SYSTEM_PROMPT }
];


while(1){
    const query = readlineSync.question("Enter the Query: ");
    const q = { type : "user" , "user" : query };
    messages.push({ role: "user", content: JSON.stringify(q) });

    while(true){
        const chat = await client.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: messages,
        });


        const result = chat.choices[0].message.content;
        messages.push({ role: "assistant", content: result });

        const call = JSON.parse(result);

        if(call.type === "output"){
            console.log(`🤖: ${call.output}`);
            break;
        } else if(call.type === "action"){
            const fn = tools[call.function];
            if (!fn) {
                console.error(`Function ${call.function} not found.`);
                break;
            }
            const observation = await fn(call.input);
            const obs = { type: "observation", observation: observation };
            messages.push({ role: "developer", content: JSON.stringify(obs) });
        } 
    }
}