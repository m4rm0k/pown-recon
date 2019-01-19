exports.yargs = {
    command: 'transform <transform>',
    describe: 'Perform inline transformation',
    aliases: ['t'],

    builder: (yargs) => {
        const { Scout } = require('../scout')

        const scout = new Scout()

        scout.registerModuleTransforms('./transforms/pks')
        scout.registerModuleTransforms('./transforms/hibp')
        scout.registerModuleTransforms('./transforms/crtsh')
        scout.registerModuleTransforms('./transforms/github')
        scout.registerModuleTransforms('./transforms/gravatar')
        scout.registerModuleTransforms('./transforms/dockerhub')
        scout.registerModuleTransforms('./transforms/cloudflare')
        scout.registerModuleTransforms('./transforms/threatcrowd')

        yargs = yargs.option('read', {
            alias: 'r',
            description: 'Read file'
        })

        yargs = yargs.option('write', {
            alias: 'w',
            description: 'Write file'
        })

        Object.entries(scout.transformers).forEach(([transformName, transform]) => {
            yargs = yargs.command({
                command: `${transformName} [options] <nodes...>`,
                aliases: transform.alias,
                describe: transform.description,

                builder: (yargs) => {
                    yargs = yargs.options('format', {
                        description: 'Output format',
                        alias: 'f',
                        type: 'string',
                        default: 'table',
                        choices: ['table', 'json', 'csv']
                    })

                    Object.entries(transform.options).forEach(([optionName, option]) => {
                        yargs = yargs.options(optionName, {
                            describe: option.description,
                            type: 'string',
                            default: option.default
                        })
                    })
                },

                handler: async(argv) => {
                    const { Logger } = require('@pown/cli/lib/logger')

                    const logger = new Logger(argv)

                    scout.on('info', logger.info)
                    scout.on('warn', logger.warn)
                    scout.on('error', logger.error)

                    const { format, nodes, read, write } = argv

                    nodes.forEach((node) => {
                        scout.addStringNode(node)
                    })

                    if (read) {
                        const fs = require('fs')
                        const util = require('util')

                        const readFile = util.promisify(fs.readFile.bind(fs))

                        let data

                        try {
                            data = await readFile(read)
                        }
                        catch (e) {
                            logger.error(`Cannot read file ${read}`)
                        }

                        let json

                        if (data) {
                            try {
                                json = JSON.parse(data.toString())
                            }
                            catch (e) {
                                logger.error(`Cannot process file ${read}`)
                            }
                        }

                        try {
                            scout.load(json)
                        }
                        catch (e) {
                            logger.error(`Cannot load file ${read}`)
                        }
                    }

                    const options = {}

                    Object.keys(transform.options).forEach((optionName) => {
                        options[optionName] = argv[optionName]
                    })

                    let results = []

                    try {
                        results = await scout.transform(transformName, options)
                    }
                    catch (e) {
                        logger.error(e)
                    }

                    if (write) {
                        const fs = require('fs')
                        const util = require('util')

                        const writeFile = util.promisify(fs.writeFile.bind(fs))

                        let json

                        try {
                            json = scout.save()
                        }
                        catch (e) {
                            logger.error(`Cannot save scout data`)
                        }

                        let data

                        try {
                            data = JSON.stringify(json)
                        }
                        catch (e) {
                            logger.error(`Cannot stringify scout data`)
                        }

                        if (data) {
                            try {
                                await writeFile(write, data)
                            }
                            catch (e) {
                                logger.error(`Cannot save file ${write}`)
                            }
                        }
                    }

                    if (format === 'table') {
                        const fields = {}
                        const lines = []

                        results.forEach(({ props }) => {
                            const line = {}

                            Object.entries(props).forEach(([name, value]) => {
                                fields[name] = 1
                                line[name] = value
                            })

                            lines.push(line)
                        })

                        const fieldNames = Object.keys(fields)

                        const { Table } = require('@pown/cli/lib/table')

                        const table = new Table({
                            head: fieldNames
                        })

                        lines.forEach((line) => {
                            const fieldValues = fieldNames.map((name) => line[name] || '')

                            table.push(fieldValues)
                        })

                        logger.verbose(table.toString())
                    }
                    else
                    if (format === 'json') {
                        logger.verbose('[');

                        results.forEach(({ props }) => {
                            logger.verbose(JSON.stringify(props))
                        })

                        logger.verbose(']');
                    }
                    else
                    if (format === 'csv') {
                        const fields = {}
                        const lines = []

                        results.forEach(({ props }) => {
                            const line = {}

                            Object.entries(props).forEach(([name, value]) => {
                                fields[name] = 1
                                line[name] = value
                            })

                            lines.push(line)
                        })

                        const fieldNames = Object.keys(fields)

                        logger.verbose('#' + fieldNames.join(','))

                        lines.forEach((line) => {
                            const fieldValues = fieldNames.map((name) => JSON.stringify(line[name] || ''))

                            logger.verbose(fieldValues.join(','))
                        })
                    }
                }
            })
        })
    },

    handler: (argv) => {
        argv.context.yargs.showHelp()
    }
}