import { createApp } from 'vue'
import { config as faConfig } from '@fortawesome/fontawesome-svg-core'
import './style.css'

// icons are sized explicitly via Tailwind classes, so skip FontAwesome's injected CSS
faConfig.autoAddCss = false
import App from './App.vue'
import { locale } from './i18n'

document.documentElement.lang = locale()
createApp(App).mount('#app')
