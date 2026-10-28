// Run after the existing CMS binds its positional keys and the wizard initializes.
document.addEventListener('DOMContentLoaded', () => {
  const paths = [
    '<path d="m3 12 7-8h12l7 8-13 17L3 12Zm0 0h26M10 4l6 25L22 4M10 4l6 8 6-8"/>',
    '<path d="m13 3-1 4-4 2-4-1-2 5 3 3-1 4 4 3 4-1 3 4 5-1 1-4 4-2 4 1 2-5-3-3 1-4-4-3-4 1-3-4Z"/><circle cx="16" cy="15" r="5"/>',
    '<path d="M16 3 5 7v9c0 6 11 13 11 13s11-7 11-13V7L16 3Z"/><path d="m10 15 4 4 8-9"/>',
    '<circle cx="16" cy="10" r="4"/><path d="M8 28v-4c0-7 16-7 16 0v4M7 7c-6 0-6 8 0 8M25 7c6 0 6 8 0 8M3 25v-3c0-3 2-5 5-5M29 25v-3c0-3-2-5-5-5"/>'
  ];
  const labels = ['ხარისხი დეტალებში', 'თანამედროვე ტექნოლოგიები', 'სანდოობა და გარანტია', 'პროფესიონალი გუნდი'];
  document.querySelectorAll('.stat').forEach((stat, i) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 32 32');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = paths[i];
    stat.prepend(svg);
    // The original statistics remain available to CMS; these are separate presentation labels.
    const label = document.createElement('span');
    label.className = 'v2-trust-label';
    label.textContent = labels[i];
    stat.querySelector('span:not(.v2-trust-label)').hidden = true;
    stat.append(label);
  });
  const head = document.querySelector('#projects .section-head');
  const subtitle = head.querySelector('p');
  head.firstElementChild.append(subtitle);
  const all = document.createElement('a');
  all.className = 'v2-all-projects';
  all.href = '#projects';
  all.textContent = 'ყველა პროექტი →';
  all.addEventListener('click', () => document.querySelector('#projects').classList.add('v2-all-expanded'));
  head.append(all);
  const menu = document.querySelector('.menu');
  menu.setAttribute('aria-controls', 'main-navigation');
  document.querySelector('.links').id = 'main-navigation';
  document.querySelectorAll('.links a').forEach(a => a.addEventListener('click', () => menu.setAttribute('aria-expanded', 'false')));
});
