const { got } = require('./http-client')
const iconv = require('iconv-lite')

module.exports = getPage

function getPage({ url, format, requestMethod, charset, data, headers }) {
  if (format === 'info' || requestMethod === 'HEAD') {
    return getPageInfo(url)
  } else if (format === 'raw') {
    return getRawPage(url, requestMethod, charset, data, headers)
  }

  return getPageContents(url, requestMethod, charset)
}

async function getPageInfo(url) {
  const { response, error } = await request(url, 'HEAD')
  if (error) return processError(error)

  return {
    url: url,
    content: '',
    contentType: response.headers['content-type'],
    contentLength: +response.headers['content-length'] || -1,
    http_code: response.statusCode,
  }
}

async function getRawPage(url, requestMethod, charset, data, headers) {
  const { content, response, error } = await request(
    url,
    requestMethod,
    true,
    charset,
    data,
    headers
  )
  if (error) return processError(error)

  const contentLength = Buffer.byteLength(content)
  return {
    content,
    contentType: response.headers['content-type'],
    contentLength,
  }
}

async function getPageContents(url, requestMethod, charset) {
  const { content, response, error } = await request(
    url,
    requestMethod,
    false,
    charset
  )
  if (error) return processError(error)

  const contentLength = Buffer.byteLength(content)
  return {
    contents: content.toString(),
    status: {
      url: url,
      contentType: response.headers['content-type'],
      content_length: contentLength,
      http_code: response.statusCode,
    },
  }
}

async function request(
  url,
  requestMethod,
  raw = false,
  charset = null,
  data = {},
  headers = {}
) {
  try {
    let options = {
      method: requestMethod,
      decompress: !raw,
      // headers,
      headers: {
        Accept: '*/*',
      },
    }
    if (Object.keys(data).length > 0 && requestMethod === 'POST') {
      options = {
        ...options,
        headers: {
          ...options.headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    }
    const response = await got(url, options)

    if (options.method === 'HEAD') return { response }

    return processContent(response, charset)
  } catch (error) {
    console.log(error)
    return { error }
  }
}

async function processContent(response, charset) {
  const res = { response: response, content: response.body }
  if (charset && iconv.encodingExists(charset)) {
    res.content = iconv.decode(res.content, charset)
  }
  return res
}

async function processError(e) {
  const { response } = e
  if (!response) return { contents: null, status: { error: e } }

  const { url, statusCode: http_code, headers, body } = response
  const contentLength = Buffer.byteLength(body)

  return {
    contents: body.toString(),
    status: {
      url,
      http_code,
      contentType: headers['content-type'],
      content_length: contentLength,
    },
  }
}
