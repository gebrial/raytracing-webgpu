import './style.css'

// Replace the app div with a canvas for WebGPU rendering
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = '';
const canvas = document.createElement('canvas');
// Set canvas to fill the window
canvas.style.width = '100vw';
canvas.style.height = '100vh';
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
canvas.style.display = 'block';
canvas.style.margin = '0';
canvas.style.padding = '0';
canvas.style.position = 'absolute';
canvas.style.top = '0';
canvas.style.left = '0';
app.appendChild(canvas);

// Dynamically resize canvas on window resize
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

// Initialize WebGPU and render
import('./webgpu/init').then(async ({ initWebGPU }) => {
  const { device, context } = await initWebGPU(canvas);
  const { render } = await import('./webgpu/renderer');
  // Call render and keep cleanup function
  let cleanup: (() => void) | undefined;
  cleanup = await render(device, context);
  // Optionally handle cleanup on hot reload or navigation
  cleanup?.();
}).catch(err => {
  app.innerHTML = `<p style="color:red;">${err.message}</p>`;
});
