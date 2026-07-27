# Web Proxy - Access Freely

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An accessible, mobile-first web proxy built with **Next.js**, **React**, and **TypeScript**. Designed for iOS Safari and optimized for accessibility with screen reader support and keyboard navigation.

## ✨ Features

- 📱 **Mobile-First Design** - Optimized for iPhone and iPad
- ♿ **Fully Accessible** - WCAG 2.1 AA compliant with ARIA labels and semantic HTML
- 🎨 **Dark Mode Support** - Automatically adapts to system preferences
- 🔒 **Security First** - Blocks local/private networks, validates all URLs
- ⚡ **Fast & Lightweight** - Built with Next.js for optimal performance
- 🍎 **PWA Compatible** - Install as an app on iOS (via "Add to Home Screen")
- 🎯 **Simple UI** - Minimal interface, focused on usability

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or compatible runtime
- npm or yarn

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/skyesimyikheng225183student-crypto/Web-proxy.git
cd Web-proxy
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

```bash
cp .env.local.example .env.local
```

4. **Run development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## 📱 Using on iOS

1. Open Safari on your iPhone/iPad
2. Navigate to your deployed Web Proxy URL
3. Tap the **Share** button (arrow pointing up)
4. Select **Add to Home Screen**
5. The app will now appear as a native app on your home screen

## 🏗️ Architecture

```
Web-proxy/
├── app/
│   ├── api/
│   │   └── proxy/
│   │       └── route.ts          # Backend proxy API handler
│   ├── layout.tsx                # Root layout with metadata
│   ├── page.tsx                  # Main home page
│   ├── globals.css               # Global styles & CSS variables
│   └── page.module.css           # Page-specific styles
├── components/
│   ├── ProxyForm.tsx             # URL input form component
│   ├── ProxyForm.module.css      # Form styles
│   ├── BrowserFrame.tsx          # Iframe wrapper component
│   └── BrowserFrame.module.css   # Frame styles
├── public/
│   └── manifest.json             # PWA manifest
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── next.config.js                # Next.js config
└── .env.local.example            # Environment template
```

## 🔄 How It Works

1. **User Input** - Enter a website URL in the form (e.g., `example.com`)
2. **Form Validation** - URL is validated client-side
3. **API Request** - Sends request to `/api/proxy?url=<target-url>`
4. **Server Proxy** - Backend fetches the target website
5. **Response** - HTML is returned with modified headers for CORS
6. **Iframe Display** - Content rendered in a sandboxed iframe

## 🔒 Security Features

- ✅ **URL Validation** - Only accepts valid URLs
- ✅ **Local Network Blocking** - Blocks `localhost`, private IPs (`192.168.*`, `10.*`, etc.)
- ✅ **Iframe Sandbox** - Sandboxed iframe with restricted permissions
- ✅ **Header Filtering** - Only safe headers are proxied
- ✅ **Timeout Protection** - 10-second request timeout
- ✅ **Error Handling** - Graceful error messages

## ♿ Accessibility

- ✅ Semantic HTML structure
- ✅ ARIA labels and roles
- ✅ Keyboard navigation support
- ✅ Focus management
- ✅ High contrast support
- ✅ Reduced motion support (`prefers-reduced-motion`)
- ✅ Screen reader optimized
- ✅ Touch-friendly buttons (min 44×44px)

## 📋 Browser Support

- ✅ iOS Safari 14+
- ✅ Safari (macOS)
- ✅ Chrome/Edge (all versions)
- ✅ Firefox (all versions)

## 🛠️ Development

### Project Structure

- **Frontend**: React with TypeScript
- **Backend**: Next.js API routes
- **Styling**: CSS Modules with CSS variables
- **HTTP Client**: Axios for server-side requests

### Available Scripts

```bash
# Development
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## 🚨 Limitations

- Some websites may not work if they have strict CORS policies or anti-proxy measures
- JavaScript-heavy sites may have limited functionality
- Cookies are not persisted between sessions
- Plugins (Flash, etc.) are not supported
- Some external resources may be blocked by their servers

## ⚖️ Legal & Ethical

This proxy is intended for **legitimate purposes only**. Users are responsible for:
- Complying with website Terms of Service
- Respecting copyright and intellectual property
- Following local laws and regulations
- Not using this to bypass security measures for malicious purposes

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests
- Improve accessibility

## 💡 Future Enhancements

- [ ] Rate limiting
- [ ] Request caching
- [ ] History management
- [ ] Bookmarks feature
- [ ] Dark mode toggle
- [ ] Multiple tabs support
- [ ] Search integration

## 📞 Support

If you encounter issues:

1. Check that the website is publicly accessible
2. Try a different website to isolate the problem
3. Check browser console for errors (F12)
4. Ensure you're using a supported browser

---

**Made with ❤️ for accessible web browsing**
