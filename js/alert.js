const TYPE_CONFIG = {
    success: {
        className: 'app-alert__dialog--success',
        defaultTitle: 'Success'
    },
    error: {
        className: 'app-alert__dialog--error',
        defaultTitle: 'Something went wrong'
    },
    warning: {
        className: 'app-alert__dialog--warning',
        defaultTitle: 'Please review'
    },
    info: {
        className: 'app-alert__dialog--info',
        defaultTitle: 'Notice'
    }
};

let alertRoot;
let dialogElement;
let overlayElement;
let messageElement;
let titleElement;
let confirmButton;
let activeResolver = null;
let previousFocus = null;

function ensureAlertRoot() {
    if (alertRoot) {
        return;
    }

    alertRoot = document.createElement('div');
    alertRoot.className = 'app-alert';
    alertRoot.setAttribute('aria-hidden', 'true');

    alertRoot.innerHTML = `
        <div class="app-alert__overlay" data-alert-overlay></div>
        <div class="app-alert__dialog" role="alertdialog" aria-modal="true" aria-labelledby="app-alert-title" aria-describedby="app-alert-message">
            <div class="app-alert__header">
                <h2 class="app-alert__title" id="app-alert-title"></h2>
                <button type="button" class="app-alert__close" data-alert-close aria-label="Close alert">&times;</button>
            </div>
            <div class="app-alert__body">
                <p class="app-alert__message" id="app-alert-message"></p>
            </div>
            <div class="app-alert__actions">
                <button type="button" class="btn btn-primary app-alert__confirm" data-alert-confirm>OK</button>
            </div>
        </div>
    `;

    dialogElement = alertRoot.querySelector('.app-alert__dialog');
    overlayElement = alertRoot.querySelector('[data-alert-overlay]');
    messageElement = alertRoot.querySelector('.app-alert__message');
    titleElement = alertRoot.querySelector('.app-alert__title');
    confirmButton = alertRoot.querySelector('[data-alert-confirm]');

    overlayElement.addEventListener('click', handleDismiss);
    confirmButton.addEventListener('click', handleDismiss);

    const closeButton = alertRoot.querySelector('[data-alert-close]');
    closeButton.addEventListener('click', handleDismiss);

    document.addEventListener('keydown', event => {
        if (!alertRoot.classList.contains('app-alert--active')) {
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            handleDismiss();
        }
        if (event.key === 'Tab') {
            maintainFocus(event);
        }
    });

    alertRoot.addEventListener('transitionend', event => {
        if (event.propertyName === 'opacity' && !alertRoot.classList.contains('app-alert--active')) {
            alertRoot.setAttribute('aria-hidden', 'true');
        }
    });

    document.body.appendChild(alertRoot);
}

function maintainFocus(event) {
    if (!dialogElement) {
        return;
    }

    const focusableSelectors = [
        'button',
        '[href]',
        'input',
        'select',
        'textarea',
        '[tabindex]:not([tabindex="-1"])'
    ];

    const focusable = Array.from(
        dialogElement.querySelectorAll(focusableSelectors.join(','))
    ).filter(element => !element.hasAttribute('disabled'));

    if (focusable.length === 0) {
        event.preventDefault();
        return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const focused = document.activeElement;

    if (event.shiftKey && focused === first) {
        event.preventDefault();
        last.focus();
        return;
    }

    if (!event.shiftKey && focused === last) {
        event.preventDefault();
        first.focus();
    }
}

function handleDismiss() {
    if (!alertRoot) {
        return;
    }

    alertRoot.classList.remove('app-alert--active');
    dialogElement.classList.remove(
        'app-alert__dialog--info',
        'app-alert__dialog--success',
        'app-alert__dialog--warning',
        'app-alert__dialog--error'
    );

    if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus({ preventScroll: true });
    }
    previousFocus = null;

    if (activeResolver) {
        const resolve = activeResolver;
        activeResolver = null;
        resolve();
    }

    setTimeout(() => {
        alertRoot.setAttribute('aria-hidden', 'true');
    }, 150);
}

export function showAlert(message, options = {}) {
    if (!document.body) {
        console.warn('Attempted to show an alert before the document body was available.');
        return Promise.resolve();
    }

    ensureAlertRoot();

    const {
        title,
        type = 'info',
        confirmText = 'OK'
    } = options;

    const typeConfig = TYPE_CONFIG[type] || TYPE_CONFIG.info;

    dialogElement.classList.add(typeConfig.className);

    const activeTitle = title ?? typeConfig.defaultTitle;
    if (activeTitle) {
        titleElement.textContent = activeTitle;
        titleElement.style.display = '';
    } else {
        titleElement.textContent = '';
        titleElement.style.display = 'none';
    }

    messageElement.textContent = message;
    confirmButton.textContent = confirmText;

    previousFocus = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    alertRoot.setAttribute('aria-hidden', 'false');
    alertRoot.classList.add('app-alert--active');

    requestAnimationFrame(() => {
        confirmButton.focus({ preventScroll: true });
    });

    return new Promise(resolve => {
        activeResolver = resolve;
    });
}

export default showAlert;

