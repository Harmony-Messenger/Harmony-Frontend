<p align="center">
  <img src="harmony-logo.svg" alt="Harmony Messenger Logo" width="560" />
</p>
 
<h1 align="center">Harmony Messenger - Frontend</h1>
 
<p align="center">
  A self-hosted, open-source messaging platform with text, voice, and screen sharing.
</p>
 
<p align="center">
  <a href="https://github.com/Harmony-Messenger/Harmony-Frontend/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg" alt="License: AGPL-3.0" />
  </a>
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" />
  <img src="https://img.shields.io/badge/self--hosted-yes-blueviolet" alt="Self Hosted" />
</p>

<p align="center">
  <strong>This is the frontend component.  You will need a backend API component such as:  <a href="https://github.com/Harmony-Messenger/Harmony-Backend">https://github.com/Harmony-Messenger/Harmony-Backend</a></strong>
</p>
 
---
 
## 📸 Screenshots
 
| Text Channels | Voice Channels | Screen Share |
|:---:|:---:|:---:|
| ![Text](screenshots/text.png) | ![Voice](screenshots/voice.png) | ![Screen](screenshots/screenshare.png) |
 
---
 
## ✨ Features
 
- 💬 **Text Channels** — Organised, real-time messaging with role-based access control
- 🎙️ **Voice Channels** — Low-latency audio
- 🖥️ **Screen Sharing** — Live screen broadcast with VP8/VP9 video streaming
- 👥 **User Management** — Ban, activate, and reset passwords for users
- 🔐 **Role & Permission System** — Granular per-channel and global permissions
- 📨 **Direct Messages** — End to end encrypted direct messages
- 🌐 **Fully Self-Hosted** — You own your data, your server, your community
 
---
 
## 🚀 Installation
 
### Prerequisites
 
- Node.js 18+
- A web server (Nginx or Apache)
 

### 1. Clone the repository
 
```bash
git clone https://github.com/Harmony-Messenger/Harmony-Frontend.git
cd Harmony-Frontend
```

### 2. Install dependencies
 
```bash
npm install
```

### 3. Build for production
 
```bash
npm run build
```

### 4. Set up directory structure and copy files if necessary
 
```bash
mkdir /var/www/frontend
mkdir /var/www/frontend/public_html
cp -r dist/spa/* /var/www/frontend/public_html
```

### 5. Set permissions (note, http:http may not be the user your web server runs as, change as appropriate)
 
```bash
chown -R http:http /var/www/frontend
chmod -R 774 /var/www/frontend
```

### 6. Configure your web server

Providing instructions for general setup of your webserver is beyond the scope of these instructions.

All requests need to route to the index.html file.

The config that works for me:
 
```nginx
server {
  listen       443 ssl;
  server_name  yourservername;

  http2 on;
	client_max_body_size 32M;	
	
	ssl_certificate /etc/nginx/ssl/cert.pem;
	ssl_certificate_key /etc/nginx/ssl/key.pem;

	ssl_protocols TLSv1.3;
	ssl_ciphers HIGH:!aNULL:!MD5;

	root /var/www/backend/public_html;

	access_log /var/log/nginx/access.log;

	location / {
	    root /var/www/frontend/public_html;
	    index index.html;
	    try_files $uri $uri/ /index.html;
	}

```
 
### 7. Edit server.json and enter the URI for your backend API.

 
> ✅ The frontend should now be running at your configured domain.  Head over to <a href="https://github.com/Harmony-Messenger/Harmony-Frontend">https://github.com/Harmony-Messenger/Harmony-Backend</a> in order to get the backend API if you haven't already.
 
---
 
## 🤝 Contributing
 
Contributions, bug reports, and feature requests are welcome! Please open an issue or submit a pull request.
 
---
 
## 📄 License
 
Harmony Messenger is licensed under the **[GNU Affero General Public License v3.0](LICENSE)**.
 
This means if you modify and run this software as a network service, you must make your modified source code available to your users.
