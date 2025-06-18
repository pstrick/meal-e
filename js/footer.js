import { version } from './version.js';
// Inject universal footer
fetch('footer.html')
  .then(res => res.text())
  .then(html => {
    document.body.insertAdjacentHTML('beforeend', html);
    // Update version in the injected footer
    const versionSpan = document.querySelector('footer .version');
    if (versionSpan) versionSpan.textContent = `v${version.toString()}`;
  }); 