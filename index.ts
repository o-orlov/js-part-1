import type { CountryCodeMap, Country } from './types.js';
import CountriesService from './CountriesService.js';
import RouteFinder from './RouteFinder.js';

const form = document.getElementById('form') as HTMLFormElement;
const fromCountry = document.getElementById('fromCountry') as HTMLSelectElement;
const toCountry = document.getElementById('toCountry') as HTMLSelectElement;
const countriesList = document.getElementById('countriesList') as HTMLDataListElement;
const submit = document.getElementById('submit') as HTMLButtonElement;
const output = document.getElementById('output') as HTMLDivElement;

const countriesService = new CountriesService();
const routeFinder = new RouteFinder(countriesService);

function setInteractionDisabled(disabled: boolean): void {
    fromCountry.disabled = disabled;
    toCountry.disabled = disabled;
    submit.disabled = disabled;
}

function showMessage(message: string): void {
    output.textContent = message;
}

function showError(error: Error): void {
    output.textContent = `Error: ${error.message}`;
}

function showResult(result: [Array<string[]> | null, number]): void {
    let route = '';
    if (result[0] !== null) {
        for (const variant of result[0]) {
            route += `${variant.join(' → ')}\r\n`;
        }
        route = route.trim();
    } else {
        route = `Route from ${fromCountry.value} to ${toCountry.value} not found.`;
    }
    output.textContent = `${route}\r\n\r\nAPI calls: ${result[1]}`;
}

function clearMessage(): void {
    output.textContent = '';
}

(async () => {
    setInteractionDisabled(true);

    showMessage('Loading…');
    let countriesData: CountryCodeMap<Country> = {};
    try {
        countriesData = await countriesService.getCountriesData();
        clearMessage();
    } catch (e) {
        if (e instanceof Error) {
            showError(e);
        }
    }

    // Заполняем список стран для подсказки в инпутах
    Object.keys(countriesData)
        .sort((a, b) => countriesData[b].area - countriesData[a].area)
        .forEach((code) => {
            const option = document.createElement('option');
            option.value = countriesData[code].name.common;
            countriesList.appendChild(option);
        });

    setInteractionDisabled(false);

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        clearMessage();
        setInteractionDisabled(true);
        showMessage(`Finding route from ${fromCountry.value} to ${toCountry.value}…`);
        routeFinder
            .findRoute(fromCountry.value, toCountry.value)
            .then(showResult)
            .catch(showError)
            .finally(() => {
                setInteractionDisabled(false);
            });
    });
})();
