
# socket.io-computer

A collaborative virtual machine where players take turns in
controlling it.

It works by running [qemu](http://wiki.qemu.org/Main_Page) on the
server-side and streaming the image binary data to the browser.

![](https://i.cloudup.com/eLzCA3vYK5.gif)

## Dependencies

In order to run `socket.io-computer` you must have the following
dependencies installed:

- `qemu`
- `redis-server`

On the mac, all of the above are available on [homebrew](http://brew.sh/).

## How to run

First you should create an image onto which you'll load (install) the
operating system ISO. We'll call it for this example `winxp.img`.

```bash
$ qemu-img create -f qcow2 winxp.img 3G
```

Then you can run the additional needed processes:

```bash
# web server
$ node app.js

# io server
$ node io.js

# qemu instance
$ COMPUTER_ISO=winxp.iso COMPUTER_IMG=winxp.img node qemu.js

# emulator communication process
$ COMPUTER_IMG=winxp.img node emu-runner.js
```

Then point your browser to `http://localhost:5000`.

## Docker

Create a local `images` directory with the disk image and installer ISO
expected by `docker-compose.yml`:

```bash
mkdir -p images
qemu-img create -f qcow2 images/disk.qcow2 3G
# put your installer at images/install.iso
```

Then run the stack:

```bash
docker compose up --build
```

The web UI is exposed on `http://localhost:5000` and Socket.IO is exposed on
`http://localhost:6001`. The QEMU service binds VNC and monitor ports inside
the Compose network; the emulator service connects to them as `qemu:5900` and
`qemu:4444`.

On a remote VPS, set `COMPUTER_IO_URL` to a browser-reachable hostname or IP
instead of `localhost`:

```bash
COMPUTER_IO_URL=http://YOUR_VPS_IP_OR_HOSTNAME:6001 docker compose up --build
```

If port `5000` is already in use on the host, remap it:

```bash
COMPUTER_WEB_HOST_PORT=55000 \
COMPUTER_IO_URL=http://YOUR_VPS_IP_OR_HOSTNAME:6001 \
docker compose up --build
```

## License

MIT
