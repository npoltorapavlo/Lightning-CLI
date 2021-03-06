const axios = require('axios')
const FormData = require('form-data')
const fs = require('fs')

const releaseAction = require('./release')
const sequence = require('../helpers/sequence')
const ask = require('../helpers/ask')
const spinner = require('../helpers/spinner')
const exit = require('../helpers/exit')

const UPLOAD_ERRORS = {
  version_already_exists: 'The current version of your app already exists',
  missing_field_file: 'There is a missing field',
  app_belongs_to_other_user: 'You are not the owner of this app',
}

const login = key => {
  spinner.start('Authenticating with Metrological Back Office')
  return axios
    .get('https://api.metrological.com/api/authentication/login-status', {
      headers: { 'X-Api-Token': key },
    })
    .then(({ data }) => {
      const user = data.securityContext.pop()
      if (user) {
        spinner.succeed()
        return user
      }
      exit('Unexepected authentication error')
    })
    .catch(err => {
      exit('Incorrect API key or not logged in to metrological dashboard')
    })
}

const upload = (packageData, user) => {
  spinner.start('Uploading package to Metrological Back Office')
  if (!packageData.identifier) {
    exit("Metadata.json doesn't contain an identifier field")
  }
  if (!packageData.version) {
    exit("Metadata.json doesn't contain an version field")
  }

  const form = new FormData()
  form.append('id', packageData.identifier)
  form.append('version', packageData.version)
  form.append('upload', fs.createReadStream(packageData.tgzFile))

  const headers = form.getHeaders()
  headers['X-Api-Token'] = user.apiKey

  axios
    .post('https://api.metrological.com/api/' + user.type + '/app-store/upload-lightning', form, {
      headers,
    })
    .then(({ data }) => {
      // errors also return a 200 status reponse, so we intercept errors here manually
      if (data.error) {
        exit(UPLOAD_ERRORS[data.error] || data.error)
      } else {
        spinner.succeed()
      }
    })
    .catch(err => {
      exit(UPLOAD_ERRORS[err] || err)
    })
}

module.exports = () => {
  let user
  return sequence([
    // todo: save API key locally for future use and set it as default answer
    () => ask('Please provide your API key'),
    apiKey => login(apiKey).then(usr => ((user = usr), (usr.apiKey = apiKey))),
    () => releaseAction(),
    packageData => upload(packageData, user),
  ])
}
