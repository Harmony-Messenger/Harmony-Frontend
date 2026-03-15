import { defineBoot } from '#q-app/wrappers'
import axios from 'axios'

// Be careful when using SSR for cross-request state pollution
// due to creating a Singleton instance here;
// If any client changes this (global) instance, it might be a
// good idea to move this instance creation inside of the
// "export default () => {}" function below (which runs individually
// for each client)

const api = axios.create();

axios.get('/server.json').then(response => {
  api.defaults.baseURL = response.data.api;
  api.defaults.headers.common['Authorization'] = 'bearer '+localStorage.getItem('AuthToken');
});

export default defineBoot(({ app }) => {
  // for use inside Vue files (Options API) through this.$axios and this.$api

  app.config.globalProperties.$axios = axios
  // ^ ^ ^ this will allow you to use this.$axios (for Vue Options API form)
  //       so you won't necessarily have to import axios in each vue file

  app.config.globalProperties.$api = api
  // ^ ^ ^ this will allow you to use this.$api (for Vue Options API form)
  //       so you can easily perform requests against your app's API
})

axios.defaults.validateStatus = function (status) {
  return status < 500; // Reject only if the status code is greater than or equal to 500
}

api.defaults.validateStatus = function (status) {
  if(status == 401)
  {
    localStorage.removeItem('AuthToken');
    window.location.reload();
  }

  return status < 500; // Reject only if the status code is greater than or equal to 500
}


export { api }
