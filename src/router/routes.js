const routes = [
  {
    path: '/',
    component: () => import('pages/MainPage.vue'),
  },
  {
    path: '/channel/:channelid',
    component: () => import('pages/MainPage.vue')
  },
  {
    path: '/user/:username',
    component: () => import('pages/MainPage.vue'),
    meta: {
      name: 'Profile'
    }
  },
  {
    path: '/video/:username',
    component: () => import('pages/MainPage.vue'),
    meta: {
      name: 'Screen Share'
    }
  },

  {
    path: '/dm/:username',
    component: () => import('pages/MainPage.vue'),
    meta: {
      name: 'DM'
    }
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue')
  }
]

export default routes
