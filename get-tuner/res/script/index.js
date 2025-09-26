
const sectionMajorDivs = document.querySelectorAll('div.section-major');
const executeOutputs = document.querySelectorAll('.execute-output');

function setSectionTo(index) {
    if (index < 0 || index >= sectionMajorDivs.length) return;
    sectionMajorDivs.forEach((div, i) => {
        div.classList.toggle('section-current', i === index);
    });
    reset_connection_messages();
    reset_activation_messages();
    has_shown_connect_error = false;
    hide_install_progress();
    hide_execute_outputs();    
}

let has_shown_connect_error = false;
let show_detailed_connect_error = false;
let exclude_error_temporarily = false;

let is_complete = false;

function hide_execute_outputs() {
    executeOutputs.forEach(el => {
        el.classList.add('hidden');
    });
}

if (!('usb' in navigator)) {
    document.getElementById('overlay').classList.remove('hidden');
    document.getElementById('unsupported-browser-popup').classList.remove('hidden');
}


function connection_established() {
    document.querySelectorAll('.devicename').forEach(el => {
        el.textContent = get_device_name();
    });
    setSectionTo(2);
}

function showExecuteOutputs(message) {
    executeOutputs.forEach(el => {
        el.textContent = message;
        el.classList.remove('hidden');
    });
}

function reconnect() {
    exclude_error_temporarily = true;
    reset_connection_messages();
    connect_usb()
    has_shown_connect_error = false;
    show_detailed_connect_error = false;
}

function connect() {
    connect_usb()
    if (has_shown_connect_error) show_detailed_connect_error = true;
}

function reset_connection_messages() {
    document.getElementById('connect-message-no-device').classList.add('hidden');
    document.getElementById('connect-message-click-allow').classList.add('hidden');
    document.getElementById('connect-message').classList.add('hidden');
    document.getElementById('connect-button').classList.remove('hidden');
    document.getElementById('connect-message-error').classList.add('hidden');
    document.getElementById('connect-message-error-detailed').classList.add('hidden');
}

function connect_no_device_selected() {
    reset_connection_messages();
    document.getElementById('connect-message-no-device').classList.remove('hidden');
}

function connect_click_allow() {
    reset_connection_messages();
    document.getElementById('connect-message-click-allow').classList.remove('hidden');
    document.getElementById('connect-button').classList.add('hidden');
    document.getElementById('connect-message-go-back').classList.add('hidden');
    show_detailed_connect_error = false;
    has_shown_connect_error = false;
}


function connect_error() {
    if (exclude_error_temporarily) {
        setTimeout (() => {
            exclude_error_temporarily = false;
        }, 100);
        return;
    }
    reset_connection_messages();
    if (show_detailed_connect_error)
        document.getElementById('connect-message-error-detailed').classList.remove('hidden');
    else 
        document.getElementById('connect-message-error').classList.remove('hidden');
    has_shown_connect_error = true;
    document.getElementById('connect-message-go-back').classList.add('hidden');
}
function connect_message(msg) {
    reset_connection_messages();
    document.getElementById('connect-message').innerText = msg;
    document.getElementById('connect-message').classList.remove('hidden');
}

function connection_lost() {
    if (!is_complete) setSectionTo(1);
    connect_message("Connection lost. Please reconnect your device.");
}

function show_install_progress() {
    document.getElementById('install-button').classList.add('hidden');
    document.getElementById('install-progress').classList.remove('hidden');
}
function hide_install_progress() {
    document.getElementById('install-button').classList.remove('hidden');
    document.getElementById('install-progress').classList.add('hidden');
}

function activate() {
    attempt_activation(document.getElementById('activation-code').value);
    showExecuteOutputs("Attempting activation...");
    document.getElementById('activate-button').classList.add('hidden');
    document.getElementById('activate-progress').classList.remove('hidden');
}

function activation_successful() {
    is_complete = true;
    setSectionTo(4);
}

function reset_activation_messages() {
    document.getElementById('message-activate-demo').classList.remove('hidden');
    document.getElementById('message-activate-failed').classList.add('hidden');
    document.getElementById('message-activate-failed').classList.add('hidden');
    document.getElementById('activate-progress').classList.add('hidden');
    document.getElementById('activate-button').classList.remove('hidden');
    hide_execute_outputs();
}

function activation_failed() {
    reset_activation_messages();
    document.getElementById('message-activate-failed').classList.remove('hidden');
}