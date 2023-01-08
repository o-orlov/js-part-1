import CountriesService from '/CountriesService.js';
import RouteFinder from '/RouteFinder.js';

const form = document.getElementById('form');
const fromCountry = document.getElementById('fromCountry');
const toCountry = document.getElementById('toCountry');
const countriesList = document.getElementById('countriesList');
const submit = document.getElementById('submit');
const output = document.getElementById('output');

const countriesService = new CountriesService();
const routeFinder = new RouteFinder(countriesService);

function setInteractionDisabled(disabled) {
    fromCountry.disabled = disabled;
    toCountry.disabled = disabled;
    submit.disabled = disabled;
}

function showMessage(message) {
    output.textContent = message;
}

function showError(error) {
    output.textContent = `Error: ${error.message}`;
}

function showResult(result) {
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

function clearMessage() {
    output.textContent = '';
}

(async () => {
    setInteractionDisabled(true);

    showMessage('Loading…');
    const countriesData = await countriesService.getCountriesData();
    clearMessage();

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
