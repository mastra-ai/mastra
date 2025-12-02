import express from 'express'

export class OAuthCallbackServer {
  constructor() {
    this.app = express()
  }

  async listenForCode(port, path) {
    return new Promise((resolve, reject) => {
      let server
      this.app.get(path, (req, res) => {
        const code = req.query.code
        if (!code) {
          res.status(400).send('no code')
          return
        }
        res.send('Authorization successful. You can close this tab.')
        server?.close()
        resolve(code)
      })
      server = this.app.listen(port, (err) => {
        if (err) {
          reject(err)
        }
      })
    })
  }
}
